import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";

/**
 * Gates every app route behind a REAL session: the stored bearer token is
 * validated against `GET /auth/me` (see AppStateProvider) instead of trusting
 * a localStorage flag. Unauthenticated visits — including direct URL access
 * and expired/revoked tokens — redirect to /login.
 */
export function RequireAuth() {
  const { state, sessionLoading } = useAppState();

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.session.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
