import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppStateProvider } from "@/context/AppStateContext";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/routes/Login";
import Dashboard from "@/routes/Dashboard";
import Documentos from "@/routes/Documentos";
import Editor from "@/routes/Editor";
import Cumplimiento from "@/routes/Cumplimiento";
import Plantillas from "@/routes/Plantillas";
import Auditoria from "@/routes/Auditoria";
import Usuarios from "@/routes/Usuarios";
import Configuracion from "@/routes/Configuracion";

/**
 * Router setup — the 8 routes from DESIGN_SYSTEM.md section 2.
 * Phase 1 feature agents fill in each routes/*.tsx file; this file only
 * wires them up and must not be edited by feature agents (avoid merge
 * collisions — see DESIGN_SYSTEM.md section 7).
 */
export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="documentos" element={<Documentos />} />
              <Route path="editor" element={<Editor />} />
              <Route path="cumplimiento" element={<Cumplimiento />} />
              <Route path="plantillas" element={<Plantillas />} />
              <Route path="auditoria" element={<Auditoria />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="configuracion" element={<Configuracion />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AppStateProvider>
  );
}
