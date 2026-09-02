import { Bell, Search } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";

/**
 * Topbar — based on the legacy #topbar (search box, notification bell,
 * user chip with avatar/name/role). The user chip is now a read-only
 * display of who's logged in — switching users happens by logging out
 * and signing back in as a different role (see Login.tsx), instead of
 * cycling roles in place.
 */
export function Topbar() {
  const { state } = useAppState();
  const { activeUser, activeRole } = state.session;
  const initials = activeUser
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted px-3 py-2 max-w-md">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar documentos, normas..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

    </header>
  );
}
