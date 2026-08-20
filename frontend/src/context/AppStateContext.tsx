import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RoleName } from "@/data/seed";
import {
  ACCOUNT_LOCKED_EVENT,
  SESSION_EXPIRED_EVENT,
  getToken,
  setToken,
  type ApiUser,
  type LockoutDetails,
} from "@/lib/api";
import { queryKeys, resetServerState, useMeQuery } from "@/lib/queries";

// ---------------------------------------------------------------------------
// State shape
//
// Everything that lives in Postgres (documents / templates / auditLogs /
// comments / users / config) is now read through `@/lib/queries`. The reducer
// keeps ONLY local UI state: who is signed in (resolved from `GET /auth/me`),
// which document the editor has open, and the server-driven lockout overlay.
// ---------------------------------------------------------------------------

export interface SessionState {
  isAuthenticated: boolean;
  activeRole: RoleName;
  activeUser: string;
  /** uuid of the signed-in user — `PATCH /users/:id/role` keys on it. */
  activeUserId: string;
  /** True while the server reports the account as locked out (HTTP 423). */
  isLocked: boolean;
  /** Seconds until the server lifts the lock by itself, when known. */
  lockRetryAfterSeconds: number | null;
  /** Code of the document currently open in the editor. */
  activeDocCode: string;
}

export interface AppState {
  session: SessionState;
}

const initialSession: SessionState = {
  isAuthenticated: false,
  activeRole: "Administrador",
  activeUser: "",
  activeUserId: "",
  isLocked: false,
  lockRetryAfterSeconds: null,
  activeDocCode: "PRO-CAL-009",
};

export const initialAppState: AppState = { session: initialSession };

export type AppAction =
  // --- session / auth -------------------------------------------------
  | { type: "LOGIN"; payload: { user: string; role: RoleName; id: string } }
  | { type: "LOGOUT" }
  | { type: "LOCK_SYSTEM"; payload?: { retryAfterSeconds?: number | null } }
  | { type: "UNLOCK_SYSTEM" }
  | { type: "SET_ACTIVE_DOC"; payload: { code: string } }

  // --- users / roles ------------------------------------------------------
  /** Applied when `PATCH /users/:id/role` answers `isSelf: true`. */
  | { type: "SET_ACTIVE_ROLE"; payload: { role: RoleName } }

  | { type: "__NOOP" };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOGIN": {
      const { user, role, id } = action.payload;
      return {
        ...state,
        session: {
          ...state.session,
          isAuthenticated: true,
          activeUser: user,
          activeRole: role,
          activeUserId: id,
          isLocked: false,
          lockRetryAfterSeconds: null,
        },
      };
    }

    case "LOGOUT":
      return { ...state, session: { ...initialSession } };

    case "LOCK_SYSTEM":
      return {
        ...state,
        session: {
          ...state.session,
          isLocked: true,
          lockRetryAfterSeconds: action.payload?.retryAfterSeconds ?? null,
        },
      };

    case "UNLOCK_SYSTEM":
      return {
        ...state,
        session: { ...state.session, isLocked: false, lockRetryAfterSeconds: null },
      };

    case "SET_ACTIVE_DOC":
      return {
        ...state,
        session: { ...state.session, activeDocCode: action.payload.code },
      };

    case "SET_ACTIVE_ROLE":
      return {
        ...state,
        session: { ...state.session, activeRole: action.payload.role },
      };

    case "__NOOP":
      return state;

    default:
      return state;
  }
}

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** True while `GET /auth/me` is still resolving a stored token. */
  sessionLoading: boolean;
  /** Stores the token, seeds the session and drops any stale cached data. */
  signIn: (token: string, user: ApiUser) => void;
  /** Clears the token, the session and every cached server response. */
  signOut: () => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const queryClient = useQueryClient();

  // Session rehydration: the stored token is validated against `GET /auth/me`
  // on every app load, replacing the old `loadPersistedSession()` localStorage
  // read (which trusted whatever the client had written).
  const meQuery = useMeQuery();
  const hadToken = Boolean(getToken());

  useEffect(() => {
    if (!meQuery.data) return;
    dispatch({
      type: "LOGIN",
      payload: {
        user: meQuery.data.name,
        role: meQuery.data.role,
        id: meQuery.data.id,
      },
    });
  }, [meQuery.data]);

  useEffect(() => {
    if (!meQuery.isError) return;
    setToken(null);
    dispatch({ type: "LOGOUT" });
  }, [meQuery.isError]);

  // The API layer broadcasts these when an authenticated call comes back
  // 401 (token gone) or 423 (the account got locked mid-session).
  useEffect(() => {
    function onExpired() {
      dispatch({ type: "LOGOUT" });
      resetServerState(queryClient);
    }
    function onLocked(event: Event) {
      const detail = (event as CustomEvent<LockoutDetails | null>).detail;
      dispatch({
        type: "LOCK_SYSTEM",
        payload: { retryAfterSeconds: detail?.retryAfterSeconds ?? null },
      });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(ACCOUNT_LOCKED_EVENT, onLocked);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(ACCOUNT_LOCKED_EVENT, onLocked);
    };
  }, [queryClient]);

  const signIn = useCallback(
    (token: string, user: ApiUser) => {
      setToken(token);
      resetServerState(queryClient);
      queryClient.setQueryData(queryKeys.me, user);
      dispatch({
        type: "LOGIN",
        payload: { user: user.name, role: user.role, id: user.id },
      });
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    setToken(null);
    dispatch({ type: "LOGOUT" });
    resetServerState(queryClient);
  }, [queryClient]);

  const sessionLoading = hadToken && meQuery.isPending;

  return (
    <AppStateContext.Provider
      value={{ state, dispatch, sessionLoading, signIn, signOut }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

/** Read + dispatch access to the local (non-server) app state. */
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
