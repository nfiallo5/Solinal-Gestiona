import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LockScreen } from "./LockScreen";
import { useAppState } from "@/context/AppStateContext";

/** Combines Sidebar + Topbar + routed page content. Also renders the global
 * lock-screen overlay on top of every route when the API reports the account
 * as locked (HTTP 423) — see LockScreen.tsx / AppStateContext. */
export function AppShell() {
  const { state, signOut } = useAppState();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {state.session.isLocked && (
        <LockScreen
          retryAfterSeconds={state.session.lockRetryAfterSeconds}
          onDismiss={() => {
            signOut();
            navigate("/login", { replace: true });
          }}
        />
      )}
    </div>
  );
}
