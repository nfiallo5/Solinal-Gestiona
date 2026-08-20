import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Files,
  FileText,
  ShieldCheck,
  LayoutGrid,
  History,
  Users,
  Settings,
  ClipboardCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/context/AppStateContext";
import { authApi } from "@/lib/api";
import { useDocuments } from "@/lib/queries";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import logoIcon from "@/assets/logo-icon.png";
import logoWordmark from "@/assets/logo-gestiona-blanco.svg";

/**
 * Sidebar — visual pattern (navy background, mint accent, logo treatment)
 * ported from reference/lovable_mvp/src/components/solinal/Sidebar.tsx,
 * but with the 8 nav items from the legacy sidebar
 * (reference/legacy_vanilla/SolinalGestiona_MVP.html #sidebar), each
 * wired to its React Router route per DESIGN_SYSTEM.md section 2.
 *
 * Icon mapping (legacy Tabler -> lucide-react):
 *   ti-layout-dashboard -> LayoutDashboard
 *   ti-files             -> Files
 *   ti-file-text          -> FileText
 *   ti-shield-check       -> ShieldCheck
 *   ti-layout-grid        -> LayoutGrid
 *   ti-list-search        -> History (no direct "list+magnifier" icon in
 *                             lucide-react; History best matches the
 *                             semantic meaning of an audit trail log)
 *   ti-users              -> Users
 *   ti-settings           -> Settings
 */

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Legacy page id (window.pages), kept for role-restriction parity. */
  legacyPage: string;
}

const nav: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, legacyPage: "dash" },
  { label: "Documentos", to: "/documentos", icon: Files, legacyPage: "docs" },
  { label: "Editor & IA", to: "/editor", icon: FileText, legacyPage: "edit" },
  {
    label: "Cumplimiento ISO",
    to: "/cumplimiento",
    icon: ShieldCheck,
    legacyPage: "comp",
  },
  {
    label: "Plantillas",
    to: "/plantillas",
    icon: LayoutGrid,
    legacyPage: "templates",
  },
  {
    label: "Control Documental",
    to: "/control-documental",
    icon: ClipboardCheck,
    legacyPage: "control-documental",
  },
  {
    label: "Audit Trail",
    to: "/auditoria",
    icon: History,
    legacyPage: "audit",
  },
  {
    label: "Usuarios y roles",
    to: "/usuarios",
    icon: Users,
    legacyPage: "users",
  },
  {
    label: "Configuración",
    to: "/configuracion",
    icon: Settings,
    legacyPage: "config",
  },
];

/** Pages the "Lector" role cannot access (legacy js/navigation.js). */
const lectorRestricted = new Set(["edit", "templates", "audit", "config", "control-documental"]);

const COLLAPSED_STORAGE_KEY = "solinal-gestiona:sidebar-collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar() {
  const { state, signOut } = useAppState();
  const navigate = useNavigate();
  const isLector = state.session.activeRole === "Lector";
  const documentsQuery = useDocuments();
  const docCount = documentsQuery.data?.length ?? 0;
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  /** `POST /auth/logout` writes the "Cierre de sesión de …" audit entry
   * server-side; the client then simply drops the bearer token. */
  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // The token may already be expired/revoked — sign out locally regardless.
    }
    signOut();
    toast.success("Sesión cerrada.");
    navigate("/login", { replace: true });
  }

  const initials = state.session.activeUser
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar py-7 text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px] px-2.5" : "w-[264px] px-6",
        )}
      >
        <div className={cn("flex items-center", collapsed ? "justify-center px-0" : "px-2")}>
          {collapsed ? (
            <img src={logoIcon} alt="" className="size-8 shrink-0 object-contain" />
          ) : (
            <img
              src={logoWordmark}
              alt="Solinal. Gestiona AI"
              className="h-8 w-auto max-w-full object-contain object-left"
            />
          )}
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={cn(
            "mt-4 flex items-center gap-2.5 rounded-lg py-2 text-xs font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
          {!collapsed && "Colapsar menú"}
        </button>

        <div className="my-4 border-t border-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {nav.map(({ label, to, icon: Icon, legacyPage }) => {
            if (isLector && lectorRestricted.has(legacyPage)) return null;
            const link = (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )
                }
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && legacyPage === "docs" && docCount > 0 && (
                  <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-[11px] font-bold text-sidebar-primary-foreground">
                    {docCount}
                  </span>
                )}
              </NavLink>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mt-3 border-t border-sidebar-border pt-3">
          <div className={cn("flex items-center gap-2.5 pb-2", collapsed ? "justify-center px-0" : "px-2")}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">
                  {state.session.activeUser}
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/60">
                  {state.session.activeRole}
                </span>
              </span>
            )}
          </div>

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-destructive"
                >
                  <LogOut className="size-[18px] shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-destructive"
            >
              <LogOut className="size-[18px] shrink-0" />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
