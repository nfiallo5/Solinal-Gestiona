import React, { useState, useMemo } from "react";
import { useAppState } from "@/context/AppStateContext";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/* ================================================================
   SOLINAL · CONTROL DOCUMENTAL
   Motor documental basado en ISO 10013:2021
   Reglas obligatorias de control: ISO 9001:2015, numeral 7.5
   Capas: norma seleccionada → tipo documental → empresa
   ================================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.cd *, .cd *::before, .cd *::after { box-sizing: border-box; }
.cd {
  --navy:#0F2A4A; --navy-700:#173A63; --navy-500:#27507F;
  --mint:#25D0A0; --mint-dk:#12A97F;
  --ink:#12233A; --muted:#6B7C93; --line:#E2E7EE; --bg:#F4F6F9; --white:#fff;
  --amber:#E4A11B; --red:#D6455A; --violet:#6C5CE7;
  font-family:'Poppins','Segoe UI',system-ui,-apple-system,sans-serif;
  color:var(--ink); background:var(--bg);
  -webkit-font-smoothing:antialiased;
}
.cd button { font-family:inherit; cursor:pointer; }
.cd input, .cd select, .cd textarea { font-family:inherit; }
.cd :focus-visible { outline:2px solid var(--mint); outline-offset:2px; }

/* ---------- Sidebar ---------- */
.side { width:268px; flex:0 0 268px; background:var(--navy); color:#fff; padding:24px 16px 16px;
  display:flex; flex-direction:column; gap:4px; position:sticky; top:0; height:100vh; overflow-y:auto; }
.brand { font-size:25px; font-weight:700; letter-spacing:-.02em; padding:0 10px 16px; }
.brand span { color:var(--mint); }
.who { display:flex; gap:10px; align-items:center; padding:0 10px 14px; border-bottom:1px solid rgba(255,255,255,.14); margin-bottom:12px; }
.avatar { width:34px; height:34px; border-radius:50%; background:#D8DEE7; color:var(--navy);
  display:grid; place-items:center; font-size:12px; font-weight:700; flex:0 0 34px; }
.who b { display:block; font-size:13px; font-weight:600; line-height:1.2; }
.who small { color:#93A6BE; font-size:11.5px; }
.grp { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:#6D89AB; padding:14px 12px 6px; font-weight:600; }
.nav { display:flex; flex-direction:column; gap:2px; }
.nav button { display:flex; align-items:center; gap:11px; width:100%; background:none; border:0;
  color:#C7D3E2; font-size:13px; font-weight:500; padding:10px 12px; border-radius:8px; text-align:left; }
.nav button:hover { background:rgba(255,255,255,.07); color:#fff; }
.nav button.on { background:var(--navy-700); color:#fff; font-weight:600; }
.nav .ico { width:17px; text-align:center; font-size:13px; opacity:.9; flex:0 0 17px; }
.badge { margin-left:auto; font-size:10px; font-weight:700; background:var(--mint); color:#08322A; padding:1px 7px; border-radius:99px; }
.side .foot { margin-top:auto; padding-top:12px; border-top:1px solid rgba(255,255,255,.14); }
.burger { display:none; }

/* ---------- Main ---------- */
.main { padding:0; }
.top { display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.top h1 { margin:0; font-size:33px; font-weight:600; letter-spacing:-.02em; color:var(--navy); }
.top p { margin:6px 0 0; color:var(--muted); font-size:13.5px; max-width:66ch; line-height:1.55; }
.top .actions { margin-left:auto; display:flex; gap:10px; align-items:center; }
.btn { border:1px solid var(--line); background:#fff; color:var(--navy); font-size:13px; font-weight:600;
  padding:10px 16px; border-radius:8px; }
.btn:hover { border-color:var(--navy-500); }
.btn.pri { background:var(--navy); border-color:var(--navy); color:#fff; }
.btn.pri:hover { background:var(--navy-700); }
.btn.sm { padding:7px 11px; font-size:12px; border-radius:6px; }
.btn.gh { background:transparent; border-style:dashed; }
.bell { width:40px; height:40px; border-radius:50%; border:1px solid var(--line); background:#fff; font-size:16px; }
.rule { height:1px; background:var(--line); margin:20px 0 0; }

/* ---------- Tabs ---------- */
.tabs { display:flex; gap:3px; overflow-x:auto; padding:14px 0 0; scrollbar-width:none; }
.tabs::-webkit-scrollbar { display:none; }
.tabs button { white-space:nowrap; border:0; background:none; color:var(--muted); font-size:12.5px; font-weight:600;
  padding:10px 13px; border-radius:8px 8px 0 0; border-bottom:2px solid transparent; }
.tabs button:hover { color:var(--navy); }
.tabs button.on { color:var(--navy); border-bottom-color:var(--mint); background:#fff; }
.tabs .n { font-family:'IBM Plex Mono',monospace; font-size:10.5px; opacity:.6; margin-right:6px; }

/* ---------- Layout ---------- */
.cdgrid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-top:20px; align-items:start; }
.cdgrid.one { grid-template-columns:minmax(0,1fr); }
.cdgrid.w60 { grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); }
.stick { position:sticky; top:20px; }
.card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px; }
.card + .card { margin-top:16px; }
.card h3 { margin:0 0 4px; font-size:15px; font-weight:600; color:var(--navy); }
.card .hint { margin:0 0 16px; color:var(--muted); font-size:12.5px; line-height:1.55; }
.eyebrow { display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--mint-dk); background:#E9FBF5; border-radius:5px; padding:3px 7px; margin-bottom:10px; }
.eyebrow.b { color:var(--navy-500); background:#EAF1F9; }

/* ---------- Form atoms ---------- */
.field { margin-bottom:14px; }
.field > label { display:block; font-size:12px; font-weight:600; margin-bottom:6px; }
.field small { display:block; color:var(--muted); font-size:11.5px; margin-top:5px; line-height:1.45; }
.in, .sel, .ta { width:100%; border:1px solid var(--line); border-radius:9px; padding:9px 11px; font-size:13px;
.in, .sel, .ta { width:100%; border:1px solid var(--line); border-radius:7px; padding:9px 11px; font-size:13px;
  color:var(--ink); background:#fff; }
.in:focus, .sel:focus, .ta:focus { border-color:var(--navy-500); outline:none; }
.row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.checks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 14px; }
.chk { display:flex; gap:9px; align-items:flex-start; font-size:12.5px; cursor:pointer; }
.chk input { margin-top:2px; accent-color:var(--navy); width:15px; height:15px; }
.sw { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:10px 0; border-bottom:1px dashed var(--line); }
.sw:last-child { border-bottom:0; }
.sw b { display:block; font-size:12.5px; font-weight:600; }
.sw small { color:var(--muted); font-size:11.5px; }
.toggle { width:42px; height:24px; border-radius:99px; border:0; background:#D6DEE8; position:relative; flex:0 0 42px; transition:background .18s; }
.toggle i { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .18s; }
.toggle.on { background:var(--mint-dk); }
.toggle.on i { left:21px; }

/* ---------- Arquitectura ---------- */
.arch { display:flex; flex-direction:column; gap:7px; }
.layer { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:8px; border:1px solid var(--line); background:#FAFBFC; }
.layer .k { font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:#fff; background:var(--navy);
  padding:3px 7px; border-radius:4px; flex:0 0 auto; }
.layer b { font-size:12.5px; }
.layer small { display:block; color:var(--muted); font-size:11.5px; line-height:1.45; }
.layer.hi { background:#0F2A4A; border-color:#0F2A4A; color:#fff; }
.layer.hi small { color:#A9C4DC; }
.layer.hi .k { background:var(--mint); color:#08322A; }

/* ---------- Normas ---------- */
.norms { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
.norm { border:1.5px solid var(--line); border-radius:9px; padding:14px; background:#fff; text-align:left; }
.norm:hover { border-color:var(--navy-500); }
.norm.on { border-color:var(--navy); box-shadow:0 0 0 3px rgba(37,208,160,.22); }
.norm .h { display:flex; align-items:center; gap:8px; }
.norm .tick { width:18px; height:18px; border-radius:4px; border:1.5px solid #C7D3E2; display:grid; place-items:center;
  font-size:11px; color:#fff; flex:0 0 18px; }
.norm.on .tick { background:var(--mint-dk); border-color:var(--mint-dk); }
.norm b { font-size:13px; }
.norm small { display:block; color:var(--muted); font-size:11.5px; margin-top:5px; line-height:1.45; }
.norm .cnt { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--navy-500); margin-top:8px; display:block; }
.banner { margin-top:18px; background:var(--navy); color:#fff; border-radius:10px; padding:22px; }
.banner .big { font-size:44px; font-weight:700; line-height:1; letter-spacing:-.03em; color:var(--mint); }
.banner p { margin:8px 0 0; font-size:13.5px; color:#D2E1EE; max-width:60ch; line-height:1.55; }
.mini3 { display:flex; gap:26px; margin-top:16px; flex-wrap:wrap; }
.mini3 div b { display:block; font-size:20px; font-weight:600; }
.mini3 div small { font-size:11px; color:#8FB6D6; letter-spacing:.06em; text-transform:uppercase; }

/* ---------- Tablas ---------- */
.tblWrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
table.data { width:100%; border-collapse:collapse; font-size:12.5px; min-width:640px; }
table.data th { text-align:left; font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted);
  background:#F7F9FB; padding:10px 12px; font-weight:600; border-bottom:1px solid var(--line); white-space:nowrap; }
table.data td { padding:8px 12px; border-bottom:1px solid #F0F3F7; vertical-align:middle; }
table.data tr:last-child td { border-bottom:0; }
table.data input, table.data select { border:1px solid transparent; background:#F7F9FB; border-radius:6px;
  padding:6px 8px; font-size:12.5px; width:100%; }
table.data input:focus, table.data select:focus { border-color:var(--navy-500); background:#fff; outline:none; }
.code { font-family:'IBM Plex Mono',monospace; font-size:11.5px; background:#0F2A4A; color:#9FF3D8;
  padding:4px 8px; border-radius:5px; display:inline-block; white-space:nowrap; }
.tag { font-size:10px; font-weight:600; padding:3px 8px; border-radius:99px; white-space:nowrap; }
.del { border:0; background:none; color:var(--muted); font-size:15px; padding:2px 6px; border-radius:5px; }
.del:hover { color:var(--red); background:#FDEEF0; }
.filters { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.filters .sel, .filters .in { width:auto; min-width:150px; flex:1; }

/* ---------- Constructor de código ---------- */
.tokens { display:flex; flex-wrap:wrap; gap:8px; padding:12px; background:#F7F9FB; border:1px dashed var(--line); border-radius:8px; }
.token { display:flex; align-items:center; gap:6px; background:#fff; border:1px solid var(--line); border-radius:7px; padding:6px 8px; font-size:12px; font-weight:600; }
.token .mv { border:0; background:#EEF2F7; width:20px; height:20px; border-radius:4px; font-size:11px; color:var(--navy); }
.token .mv:hover { background:var(--navy); color:#fff; }
.chipbar { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
.chip { border:1px dashed var(--navy-500); color:var(--navy); background:#fff; font-size:11.5px; font-weight:600;
  padding:6px 10px; border-radius:99px; }
.chip:hover { background:var(--navy); color:#fff; }
.chip[disabled] { opacity:.35; cursor:not-allowed; }
.result { margin-top:14px; padding:16px; border-radius:8px; background:var(--navy); color:#fff; }
.result small { display:block; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:#8FB6D6; margin-bottom:6px; }
.result b { font-family:'IBM Plex Mono',monospace; font-size:21px; letter-spacing:.03em; color:#9FF3D8; }

/* ---------- Plantillas ---------- */
.picker { display:grid; grid-template-columns:repeat(auto-fill,minmax(205px,1fr)); gap:12px; }
.tpl { border:1.5px solid var(--line); border-radius:9px; padding:11px; background:#fff; text-align:left; }
.tpl:hover { border-color:var(--navy-500); }
.tpl.on { border-color:var(--navy); box-shadow:0 0 0 3px rgba(37,208,160,.22); }
.tpl .name { font-size:12.5px; font-weight:600; margin-top:9px; display:flex; align-items:center; gap:6px; }
.tpl .desc { font-size:11px; color:var(--muted); line-height:1.4; margin-top:3px; }
.tpl .dot { width:7px; height:7px; border-radius:50%; background:var(--mint); flex:0 0 7px; opacity:0; }
.tpl.on .dot { opacity:1; }
.mini { height:54px; border-radius:6px; background:#FAFBFC; border:1px solid var(--line); padding:5px;
  display:flex; flex-direction:column; gap:3px; overflow:hidden; }
.mini .b { background:#C9D3DF; border-radius:2px; height:5px; }
.mini .r { display:flex; gap:3px; flex:1; }
.mini .c { border:1px solid #D8E0EA; border-radius:3px; flex:1; padding:3px; display:flex; flex-direction:column; gap:2px; }
.mini .sq { width:14px; height:14px; border-radius:3px; background:var(--navy); opacity:.75; }

/* ---------- Hoja de documento ---------- */
.previewWrap { background:#EDF0F5; border:1px solid var(--line); border-radius:10px; padding:18px; overflow-x:auto; }
.sheet { width:640px; min-width:640px; background:#fff; box-shadow:0 8px 26px rgba(15,42,74,.13); padding:20px; }
.sheet .body { padding:14px 4px; font-size:10.5px; color:#3D4C60; line-height:1.6; }
.sheet .body h4 { margin:0 0 5px; font-size:11px; color:var(--navy); }
.sheet .body .ln { height:6px; background:#EEF1F5; border-radius:3px; margin:5px 0; }
.sheet .body .ln.s { width:62%; }
.doc { width:100%; border-collapse:collapse; font-size:10px; color:#101B29; }
.doc td { border:1px solid #1B1B1B; padding:5px 7px; vertical-align:middle; }
.doc .ttl { font-weight:700; text-align:center; font-size:11.5px; }
.doc .lbl { font-weight:700; }
.doc.soft td { border-color:#CBD5E1; }
.logo { width:50px; height:50px; border-radius:9px; background:var(--navy); color:#fff; display:grid; place-items:center;
  font-weight:700; font-size:15px; margin:0 auto; }
.logo.sm { width:36px; height:36px; font-size:12px; border-radius:7px; }
.rs { text-align:center; font-weight:700; color:var(--red); font-size:11px; }
.sigline { border-top:1px solid #1B1B1B; margin-top:24px; padding-top:4px; text-align:center; font-size:9.5px; }
.legend { text-align:center; font-size:9px; color:#5A6B80; margin-top:7px; line-height:1.5; }
.qr { width:42px; height:42px; border-radius:5px; background:
  repeating-conic-gradient(var(--navy) 0% 25%, #fff 0% 50%) 50%/9px 9px; border:2px solid var(--navy); }
.pill { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:600; padding:2px 7px;
  border-radius:99px; background:#E9FBF5; color:var(--mint-dk); }
.brandline { height:4px; background:linear-gradient(90deg,var(--navy) 0 62%, var(--mint) 62% 100%); border-radius:2px; }

/* ---------- Estructuras ---------- */
.typebar { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:16px; }
.typebar button { border:1px solid var(--line); background:#fff; border-radius:7px; padding:7px 11px;
  font-size:11.5px; font-weight:600; color:var(--muted); font-family:'IBM Plex Mono',monospace; }
.typebar button:hover { border-color:var(--navy-500); color:var(--navy); }
.typebar button.on { background:var(--navy); border-color:var(--navy); color:#fff; }
.secs { border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.sec { display:flex; align-items:center; gap:10px; padding:9px 12px; border-bottom:1px solid #F0F3F7; }
.sec:last-child { border-bottom:0; }
.sec input[type=checkbox] { accent-color:var(--mint-dk); width:16px; height:16px; }
.sec .nm { flex:1; font-size:12.5px; }
.sec.off .nm { color:#A9B6C6; text-decoration:line-through; }
.sec .num { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--muted); width:20px; }
.sec .mv { border:0; background:#F1F4F8; width:22px; height:22px; border-radius:5px; font-size:11px; color:var(--navy); }
.sec .mv:hover { background:var(--navy); color:#fff; }
.addsec { display:flex; gap:8px; margin-top:12px; }

/* ---------- Estados / niveles ---------- */
.states { display:flex; flex-wrap:wrap; gap:7px; align-items:center; }
.state { font-size:11.5px; font-weight:600; padding:6px 11px; border-radius:99px; }
.arrow { color:var(--muted); font-size:12px; }
.lvls { display:flex; flex-direction:column; gap:8px; }
.lvl { display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border-radius:8px; background:#FAFBFC; border:1px solid var(--line); }
.lvl .no { width:26px; height:26px; border-radius:6px; display:grid; place-items:center; color:#fff; font-size:12px; font-weight:700; flex:0 0 26px; }
.lvl b { font-size:12.5px; } .lvl small { display:block; color:var(--muted); font-size:11.5px; margin-top:2px; }

/* ---------- Cumplimiento ---------- */
.comp { display:flex; gap:12px; padding:13px 0; border-bottom:1px solid #F0F3F7; align-items:flex-start; }
.comp:last-child { border-bottom:0; }
.comp .mark { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:11px; flex:0 0 22px; color:#fff; }
.comp .cl { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--navy); font-weight:600; }
.comp b { display:block; font-size:12.5px; margin:2px 0 3px; }
.comp small { color:var(--muted); font-size:11.5px; line-height:1.5; }
.bar { height:9px; border-radius:99px; background:#E6EBF1; overflow:hidden; margin:10px 0 4px; }
.bar i { display:block; height:100%; background:linear-gradient(90deg,var(--navy),var(--mint)); transition:width .4s; }
.matrix td.rl { font-weight:600; font-size:12px; white-space:nowrap; }
.matrix input { width:16px; height:16px; accent-color:var(--mint-dk); }
.matrix td.ck { text-align:center; }
.toast { position:fixed; right:22px; bottom:22px; background:var(--navy); color:#fff; padding:13px 18px;
  border-radius:8px; font-size:13px; box-shadow:0 10px 30px rgba(15,42,74,.3); z-index:50; }

/* ---------- Segmentado y perfil ---------- */
.seg { display:inline-flex; gap:3px; padding:3px; background:#F1F4F8; border-radius:8px; flex-wrap:wrap; }
.seg button { border:0; background:none; font-size:12px; font-weight:600; color:var(--muted); padding:7px 12px; border-radius:6px; }
.seg button:hover { color:var(--navy); }
.seg button.on { background:#fff; color:var(--navy); box-shadow:0 1px 3px rgba(15,42,74,.12); }
.factors { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; }
.factor b { display:block; font-size:12px; font-weight:600; margin-bottom:7px; }
.gauge { display:flex; align-items:baseline; gap:12px; margin-top:6px; }
.gauge .num { font-size:40px; font-weight:700; letter-spacing:-.03em; color:var(--navy); line-height:1; }
.gauge .txt { font-size:12.5px; color:var(--muted); line-height:1.5; }
.steps { counter-reset:s; display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:8px; }
.step { counter-increment:s; display:flex; gap:10px; align-items:flex-start; font-size:12px; color:var(--ink);
  background:#FAFBFC; border:1px solid var(--line); border-radius:8px; padding:10px 12px; line-height:1.45; }
.step::before { content:counter(s,decimal-leading-zero); font-family:'IBM Plex Mono',monospace; font-size:11px;
  color:var(--mint-dk); font-weight:600; flex:0 0 auto; }
.kpis { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.kpi { border:1px solid var(--line); border-radius:8px; padding:10px 14px; min-width:120px; }
.kpi b { display:block; font-size:20px; font-weight:700; line-height:1.2; }
.kpi small { font-size:11px; color:var(--muted); }

/* ---------- Responsive ---------- */
@media (max-width:1180px){ .cdgrid, .cdgrid.w60 { grid-template-columns:minmax(0,1fr); } .stick { position:static; } }
@media (max-width:900px){
  .cd { flex-direction:column; }
  .side { position:static; height:auto; width:100%; flex:none; padding:14px 16px; overflow:visible; }
  .side .nav, .side .who, .side .foot, .side .grp { display:none; }
  .side.open .nav { display:flex; } .side.open .who { display:flex; }
  .side.open .foot, .side.open .grp { display:block; }
  .side .brand { display:flex; align-items:center; justify-content:space-between; padding:0; font-size:22px; }
  .burger { display:block; background:rgba(255,255,255,.12); border:0; color:#fff; font-size:16px; border-radius:7px; padding:7px 12px; }
  .main { padding:20px 16px 50px; }
  .top h1 { font-size:26px; }
  .top .actions { margin-left:0; width:100%; }
  .btn { flex:1; }
  .checks, .row2 { grid-template-columns:1fr; }
  .banner .big { font-size:34px; }
}
@media (prefers-reduced-motion:reduce){ .cd * { transition:none !important; } }
`;

/* ================================================================
   CAPA 1 · Catálogo de normas y su información documentada
   ================================================================ */

const NORMAS = [
  {
    id: "iso9001", n: "ISO 9001:2015", d: "Sistema de gestión de la calidad",
    req: [
      ["4.3", "Alcance del sistema de gestión de la calidad", "M", "MAN", "GER"],
      ["4.4.1", "Mapa e interacción de procesos", "M", "MAT", "GER"],
      ["4.4.2 a", "Información documentada de apoyo a la operación de los procesos", "M", "PRO", "GER"],
      ["5.2.2", "Política de la calidad", "M", "POL", "GER"],
      ["6.1", "Acciones para abordar riesgos y oportunidades", "M", "MAT", "GER"],
      ["6.2.1", "Objetivos de la calidad y planificación para lograrlos", "M", "PLA", "GER"],
      ["7.1.5.1", "Evidencia de la idoneidad de los recursos de seguimiento y medición", "C", "REG", "MTO"],
      ["7.1.5.2", "Base utilizada para la calibración o verificación", "C", "REG", "MTO"],
      ["7.2", "Evidencia de la competencia del personal", "C", "REG", "RHU"],
      ["7.5.3", "Listado maestro de información documentada", "M", "LST", "CAL"],
      ["8.1", "Confianza en que los procesos se realizan según lo planificado", "C", "REG", "PRD"],
      ["8.2.3.2", "Resultados de la revisión de requisitos del producto y servicio", "C", "REG", "COM"],
      ["8.3.3", "Entradas para el diseño y desarrollo", "C", "REG", "IDD"],
      ["8.3.4", "Controles del diseño y desarrollo", "C", "REG", "IDD"],
      ["8.3.5", "Salidas del diseño y desarrollo", "C", "REG", "IDD"],
      ["8.3.6", "Cambios del diseño y desarrollo", "C", "REG", "IDD"],
      ["8.4.1", "Evaluación, selección y reevaluación de proveedores externos", "C", "REG", "COM"],
      ["8.5.1", "Características del producto y de las actividades a realizar", "M", "ESP", "PRD"],
      ["8.5.2", "Identificación y trazabilidad", "C", "REG", "PRD"],
      ["8.5.3", "Propiedad del cliente o del proveedor perdida o deteriorada", "C", "REG", "LOG"],
      ["8.5.6", "Resultados de la revisión de cambios en la producción", "C", "REG", "PRD"],
      ["8.6", "Liberación de productos y servicios y autoridad que libera", "C", "REG", "CAL"],
      ["8.7.2", "Control de salidas no conformes", "C", "REG", "CAL"],
      ["9.1.1", "Resultados del seguimiento y la medición", "C", "REG", "CAL"],
      ["9.2.2", "Programa e informe de auditoría interna", "M", "PRG", "CAL"],
      ["9.3.3", "Resultados de la revisión por la dirección", "C", "REG", "GER"],
      ["10.2.2", "No conformidades, acciones correctivas y sus resultados", "C", "REG", "CAL"],
    ],
  },
  {
    id: "iso22000", n: "ISO 22000:2018", d: "Inocuidad de los alimentos",
    req: [
      ["5.2", "Política de la inocuidad de los alimentos", "M", "POL", "GER"],
      ["5.3", "Equipo de inocuidad de los alimentos y responsabilidades", "M", "MAT", "CAL"],
      ["7.2", "Competencia del equipo de inocuidad", "C", "REG", "RHU"],
      ["7.4", "Comunicación interna y externa sobre inocuidad", "M", "PRO", "CAL"],
      ["8.2", "Programas de prerrequisitos (PPR)", "M", "PRG", "CAL"],
      ["8.3", "Sistema de trazabilidad", "M", "PRO", "CAL"],
      ["8.4.2", "Preparación y respuesta ante emergencias", "M", "PLA", "GER"],
      ["8.5.1.2", "Descripción de materias primas, ingredientes y materiales en contacto", "M", "ESP", "CAL"],
      ["8.5.1.3", "Descripción de productos terminados y uso previsto", "M", "FT", "CAL"],
      ["8.5.1.5", "Diagramas de flujo y descripción de procesos", "M", "MAT", "PRD"],
      ["8.5.1.5.2", "Verificación in situ de los diagramas de flujo", "C", "REG", "PRD"],
      ["8.5.2.2", "Identificación de peligros y niveles aceptables", "M", "MAT", "CAL"],
      ["8.5.2.3", "Evaluación de peligros", "M", "MAT", "CAL"],
      ["8.5.2.4", "Selección y categorización de las medidas de control", "M", "MAT", "CAL"],
      ["8.5.3", "Validación de las medidas de control", "C", "REG", "CAL"],
      ["8.5.4", "Plan de control de peligros (PCC y PPRO)", "M", "PLA", "CAL"],
      ["8.5.4.3", "Límites críticos y criterios de acción", "M", "ESP", "CAL"],
      ["8.5.4.4", "Monitoreo de PCC y PPRO", "C", "REG", "PRD"],
      ["8.5.4.5", "Correcciones y acciones correctivas", "C", "REG", "CAL"],
      ["8.7", "Control del seguimiento y la medición", "C", "REG", "MTO"],
      ["8.9.4.3", "Manejo de producto potencialmente no inocuo", "C", "REG", "CAL"],
      ["8.9.5", "Retiro y recuperación de productos", "M", "PRO", "CAL"],
      ["9.2", "Análisis y evaluación de los resultados de verificación", "C", "REG", "CAL"],
    ],
  },
  {
    id: "fssc", n: "FSSC 22000 v6", d: "Requisitos adicionales del esquema",
    req: [
      ["8.2", "Programas de prerrequisitos (PPR)", "M", "PRG", "CAL"],
      ["2.5.1", "Gestión de servicios y materiales comprados", "M", "PRO", "COM"],
      ["2.5.2", "Etiquetado del producto y materiales impresos", "M", "PRO", "CAL"],
      ["2.5.3", "Defensa alimentaria: evaluación de amenazas y plan", "M", "PLA", "CAL"],
      ["2.5.4", "Mitigación del fraude alimentario: vulnerabilidad y plan", "M", "PLA", "CAL"],
      ["2.5.5", "Uso del logotipo y declaraciones de certificación", "M", "PRO", "COM"],
      ["2.5.6", "Gestión de alérgenos: plan y verificación", "M", "PLA", "CAL"],
      ["2.5.7", "Monitoreo ambiental: programa y resultados", "M", "PRG", "CAL"],
      ["2.5.8", "Cultura de inocuidad y calidad de los alimentos", "M", "PLA", "GER"],
      ["2.5.9", "Control de calidad: parámetros de producto y proceso", "M", "ESP", "CAL"],
      ["2.5.10", "Transporte, almacenamiento y depósito", "M", "PRO", "LOG"],
      ["2.5.12", "Verificación del producto y ensayos", "C", "REG", "CAL"],
      ["2.5.13", "Gestión de la pérdida y el desperdicio de alimentos", "M", "PRO", "GER"],
      ["2.5.15", "Gestión de equipos: especificación de compra e higiene", "M", "ESP", "MTO"],
      ["2.5.16", "Prevención de la contaminación cruzada", "M", "PRO", "PRD"],
    ],
  },
  {
    id: "haccp", n: "HACCP · Codex", d: "Análisis de peligros y PCC",
    req: [
      ["Paso 1", "Equipo HACCP y alcance del plan", "M", "MAT", "CAL"],
      ["Paso 2", "Descripción del producto y uso previsto", "M", "FT", "CAL"],
      ["Paso 4", "Diagrama de flujo verificado en planta", "M", "MAT", "PRD"],
      ["Principio 1", "Análisis de peligros", "M", "MAT", "CAL"],
      ["Principio 2", "Determinación de puntos críticos de control", "M", "MAT", "CAL"],
      ["Principio 3", "Límites críticos por PCC", "M", "ESP", "CAL"],
      ["Principio 4", "Registros de monitoreo de PCC", "C", "REG", "PRD"],
      ["Principio 5", "Registros de acciones correctivas", "C", "REG", "CAL"],
      ["Principio 6", "Procedimientos de verificación del plan HACCP", "M", "PRO", "CAL"],
    ],
  },
  {
    id: "bpm", n: "BPM · ARCSA Ecuador", d: "Buenas prácticas de manufactura",
    req: [
      ["Manual", "Manual de buenas prácticas de manufactura", "M", "MAN", "CAL"],
      ["Higiene", "Programa de limpieza y desinfección", "M", "PRG", "CAL"],
      ["Plagas", "Programa de control de plagas", "M", "PRG", "CAL"],
      ["Mantenimiento", "Programa de mantenimiento preventivo", "M", "PRG", "MTO"],
      ["Capacitación", "Programa de capacitación del personal", "M", "PRG", "RHU"],
      ["Agua", "Control y análisis de agua de proceso", "C", "REG", "CAL"],
      ["Personal", "Control de salud e higiene del personal", "C", "REG", "RHU"],
      ["Temperaturas", "Registro de temperaturas de cámaras y equipos", "C", "REG", "PRD"],
      ["Calibración", "Registro de calibración de equipos de medición", "C", "REG", "MTO"],
      ["Producto", "Ficha técnica de producto terminado", "M", "FT", "CAL"],
    ],
  },
  {
    id: "iso14001", n: "ISO 14001:2015", d: "Gestión ambiental",
    req: [
      ["4.3", "Alcance del sistema de gestión ambiental", "M", "MAN", "GER"],
      ["5.2", "Política ambiental", "M", "POL", "GER"],
      ["6.1.1", "Riesgos y oportunidades ambientales", "M", "MAT", "SSA"],
      ["6.1.2", "Aspectos ambientales y criterios de significancia", "M", "MAT", "SSA"],
      ["6.1.3", "Requisitos legales ambientales y otros requisitos", "M", "MAT", "SSA"],
      ["6.2.1", "Objetivos ambientales y planificación", "M", "PLA", "SSA"],
      ["7.4", "Comunicaciones ambientales", "C", "REG", "SSA"],
      ["8.1", "Control operacional ambiental", "M", "PRO", "PRD"],
      ["8.2", "Preparación y respuesta ante emergencias ambientales", "M", "PLA", "SSA"],
      ["9.1.1", "Seguimiento, medición, análisis y evaluación ambiental", "C", "REG", "SSA"],
      ["9.1.2", "Evaluación del cumplimiento legal ambiental", "C", "REG", "SSA"],
    ],
  },
  {
    id: "iso45001", n: "ISO 45001:2018", d: "Seguridad y salud en el trabajo",
    req: [
      ["4.3", "Alcance del sistema de gestión de SST", "M", "MAN", "GER"],
      ["5.2", "Política de seguridad y salud en el trabajo", "M", "POL", "GER"],
      ["5.4", "Consulta y participación de los trabajadores", "M", "PRO", "SSA"],
      ["6.1.2", "Identificación de peligros y evaluación de riesgos de SST", "M", "MAT", "SSA"],
      ["6.1.3", "Requisitos legales de SST y otros requisitos", "M", "MAT", "SSA"],
      ["6.2", "Objetivos de SST y planificación", "M", "PLA", "SSA"],
      ["8.1.2", "Eliminación de peligros y reducción de riesgos", "M", "PRO", "SSA"],
      ["8.2", "Preparación y respuesta ante emergencias", "M", "PLA", "SSA"],
      ["9.1.1", "Seguimiento y medición del desempeño en SST", "C", "REG", "SSA"],
      ["10.2", "Incidentes, no conformidades y acciones correctivas", "C", "REG", "SSA"],
    ],
  },
];

/* ================================================================
   CAPA 3 · Tipos documentales, niveles y estructuras recomendadas
   ================================================================ */

const NIVELES = [
  { n: 1, t: "Dirección", d: "Define el rumbo: política, alcance, objetivos y manuales.", c: "#0F2A4A" },
  { n: 2, t: "Procesos", d: "Cómo opera el sistema: procedimientos, programas y planes.", c: "#27507F" },
  { n: 3, t: "Operación", d: "Cómo se ejecuta la tarea: instructivos, especificaciones, fichas y protocolos.", c: "#12A97F" },
  { n: 4, t: "Evidencia", d: "Prueba de lo realizado: formatos en blanco y registros completados.", c: "#E4A11B" },
  { n: 5, t: "Externos", d: "No los redacta la organización: leyes, normas ISO/INEN, requisitos de clientes y fichas de proveedores.", c: "#6C5CE7" },
];

/* Factores que determinan el tipo y alcance de la información documentada · ISO 10013 4.1.1 */
const FACTORES = [
  { k: "tamano", t: "Tamaño y tipo de actividades", ops: ["Micro", "Pequeña", "Mediana", "Grande"], peso: [0, 1, 2, 3] },
  { k: "complejidad", t: "Complejidad de los procesos y sus interacciones", ops: ["Baja", "Media", "Alta"], peso: [0, 2, 3] },
  { k: "madurez", t: "Madurez del sistema de gestión", ops: ["Inicial", "En implementación", "Consolidado"], peso: [3, 2, 0] },
  { k: "riesgos", t: "Riesgos y oportunidades", ops: ["Bajos", "Moderados", "Altos"], peso: [0, 2, 3] },
  { k: "competencia", t: "Competencia de las personas", ops: ["En formación", "Media", "Alta"], peso: [3, 2, 0] },
  { k: "legal", t: "Requisitos legales y reglamentarios", ops: ["Bajos", "Moderados", "Exigentes"], peso: [0, 2, 3] },
  { k: "cliente", t: "Requisitos de clientes y partes interesadas", ops: ["Bajos", "Moderados", "Exigentes"], peso: [0, 2, 3] },
  { k: "evidencia", t: "Necesidad de evidencia de los resultados", ops: ["Baja", "Media", "Alta"], peso: [0, 2, 3] },
  { k: "remoto", t: "Accesibilidad y recuperación remota", ops: ["No requerida", "Deseable", "Indispensable"], peso: [0, 1, 2] },
];

/* Contenido de la información documentada · ISO 10013 4.1.3 */
const CONTENIDO_MINIMO = [
  { k: "alcance", t: "Alcance del sistema de gestión", cl: "4.2.1", fijo: true },
  { k: "politica", t: "Política", cl: "4.2.2", fijo: true },
  { k: "objetivos", t: "Objetivos", cl: "4.2.3", fijo: true },
  { k: "manual", t: "Manual", cl: "4.2.4.2" },
  { k: "organigrama", t: "Organigrama", cl: "4.2.4.3" },
  { k: "mapa", t: "Mapa de procesos, diagramas de flujo o descripciones de proceso", cl: "4.2.4.4" },
  { k: "procedimientos", t: "Procedimientos e instrucciones de trabajo", cl: "4.2.4.5" },
  { k: "flujos", t: "Flujos de trabajo automatizados", cl: "4.2.4.6" },
  { k: "especificaciones", t: "Especificaciones del producto y del servicio", cl: "4.2.4.7" },
  { k: "comunicaciones", t: "Comunicaciones internas y externas", cl: "4.2.4.8" },
  { k: "planes", t: "Planes, cronogramas y listas", cl: "4.2.4.9" },
  { k: "formularios", t: "Formularios y listas de verificación", cl: "4.2.4.10" },
  { k: "externos", t: "Información documentada de origen externo", cl: "4.2.4.11" },
  { k: "registros", t: "Información documentada que se conserva (registros)", cl: "4.3", fijo: true },
];

/* Estructuras de organización de la biblioteca · ISO 10013 Anexo A, tabla A.1 */
const VISTAS_A1 = [
  { k: "tipo", t: "Por tipo documental", d: "Política, objetivos, manual, procedimientos, flujos, instrucciones, formularios y registros." },
  { k: "funcional", t: "Funcional", d: "Talento humano, comercial, producción, diseño, compras, operaciones y proyectos multifuncionales." },
  { k: "interesadas", t: "Por partes interesadas", d: "Clientes, usuarios finales, proveedores externos, sociedad, reguladores, personal y accionistas." },
  { k: "mejora", t: "Por flujo de mejora", d: "Políticas, objetivos, planes de acción y resultados." },
  { k: "operacion", t: "Producción y provisión del servicio", d: "Especificaciones, requisitos, requisitos operativos, controles operativos y actas." },
];

/* Procesos aptos para flujo de trabajo automatizado · ISO 10013 4.2.4.6 */
const FLUJOS_AUTO = [
  ["docs", "Gestión de la información documentada"], ["auditoria", "Gestión de auditorías"],
  ["competencia", "Formación y competencia"], ["correctivas", "Acciones correctivas"],
  ["revisionDireccion", "Revisión por la dirección"], ["cambios", "Gestión del cambio"],
  ["compras", "Compras y gestión de proveedores"], ["calibracion", "Calibración y mantenimiento de equipos"],
  ["riesgos", "Gestión de riesgos y oportunidades"], ["seguimiento", "Seguimiento y medición"],
];

/* Pasos de implementación · ISO 10013 5.1.1 */
const PASOS_IMPL = [
  "Determinar la información documentada aplicable según la norma, el alcance y el contexto",
  "Inventariar y analizar la información documentada existente",
  "Comparar lo existente con lo requerido y decidir qué crear o mejorar",
  "Capacitar a quienes crean información documentada",
  "Definir la estructura y los niveles documentales",
  "Preparar la información documentada del alcance y de los procesos",
  "Verificar contra los requisitos de la norma elegida",
  "Validar mediante prueba en el puesto de trabajo",
  "Revisar y aprobar",
  "Liberar y controlar",
  "Capacitar sobre la información nueva o actualizada y conservar la evidencia",
  "Actualizar cuando corresponda",
];

const GAP = [
  { k: "existe", t: "Existe y es conforme", c: "#12A97F", b: "#E9FBF5" },
  { k: "mejorar", t: "Existe y debe mejorarse", c: "#E4A11B", b: "#FDF6E7" },
  { k: "falta", t: "No existe", c: "#D6455A", b: "#FDEEF0" },
];

const TIPOS_INI = [
  { s: "MAN", n: "Manual", nivel: 1, digitos: 2, ret: "Permanente", firma: true },
  { s: "POL", n: "Política", nivel: 1, digitos: 2, ret: "Permanente", firma: true },
  { s: "PRO", n: "Procedimiento", nivel: 2, digitos: 3, ret: "5 años", firma: true },
  { s: "PRG", n: "Programa", nivel: 2, digitos: 3, ret: "5 años", firma: true },
  { s: "PLA", n: "Plan", nivel: 2, digitos: 3, ret: "5 años", firma: true },
  { s: "INS", n: "Instructivo", nivel: 3, digitos: 3, ret: "3 años", firma: true },
  { s: "ESP", n: "Especificación", nivel: 3, digitos: 3, ret: "3 años", firma: true },
  { s: "FT", n: "Ficha técnica", nivel: 3, digitos: 3, ret: "Vigencia + 1 año", firma: true },
  { s: "PTC", n: "Protocolo", nivel: 3, digitos: 3, ret: "3 años", firma: true },
  { s: "MAT", n: "Matriz", nivel: 3, digitos: 3, ret: "3 años", firma: true },
  { s: "FOR", n: "Formato", nivel: 4, digitos: 3, ret: "3 años", firma: false },
  { s: "REG", n: "Registro", nivel: 4, digitos: 4, ret: "3 años", firma: false },
  { s: "LST", n: "Listado", nivel: 4, digitos: 2, ret: "Permanente", firma: false },
  { s: "DOC-EXT", n: "Documento externo", nivel: 5, digitos: 3, ret: "Vigencia + 1 año", firma: false },
];

const ESTRUCTURAS_INI = {
  POL: ["Título", "Propósito", "Alcance", "Principios y compromisos", "Lineamientos", "Responsabilidades", "Comunicación", "Revisión", "Aprobación"],
  MAN: ["Objetivo", "Alcance", "Referencias", "Definiciones", "Contexto de la organización", "Estructura organizacional", "Descripción del sistema", "Procesos", "Interacción de procesos", "Responsabilidades", "Información documentada relacionada", "Anexos"],
  PRO: ["Objetivo", "Alcance", "Referencias", "Definiciones", "Responsabilidades", "Desarrollo del procedimiento", "Diagrama de flujo", "Controles", "Registros generados", "Indicadores", "Anexos", "Historial de cambios"],
  PRG: ["Objetivo", "Alcance", "Responsables", "Actividades", "Frecuencia", "Recursos", "Indicadores", "Registros"],
  PLA: ["Objetivo", "Alcance", "Actividades", "Responsables", "Recursos", "Cronograma", "Criterios de control", "Registros"],
  INS: ["Objetivo", "Alcance", "Responsable", "Recursos y materiales", "Precauciones", "Instrucciones paso a paso", "Criterios de aceptación", "Registros", "Anexos"],
  ESP: ["Identificación", "Características y requisitos", "Límites y criterios de aceptación", "Método de evaluación", "Referencias", "Aprobación"],
  FT: ["Identificación", "Descripción", "Características", "Especificaciones", "Métodos de análisis", "Condiciones de almacenamiento", "Vida útil", "Referencias"],
  PTC: ["Objetivo", "Alcance", "Responsables", "Metodología", "Equipos y materiales", "Criterios de aceptación", "Resultados", "Conclusiones"],
  MAT: ["Objetivo o identificación", "Variables", "Responsables", "Criterios", "Estado", "Evidencia"],
  FOR: ["Identificación", "Código", "Versión", "Campos requeridos", "Responsable del registro"],
  REG: ["Identificación", "Fecha", "Responsable", "Datos y evidencia", "Resultado", "Aprobación cuando aplique"],
  LST: ["Código", "Documento", "Proceso", "Versión", "Fecha de aprobación", "Vigencia", "Responsable", "Estado", "Ubicación"],
  "DOC-EXT": ["Identificación", "Fuente o emisor", "Versión o edición", "Fecha de verificación de vigencia", "Requisitos aplicables", "Responsable", "Ubicación"],
};

const PROCESOS_INI = [
  { s: "GER", n: "Gerencia y estrategia", d: "Director de Operaciones" },
  { s: "CAL", n: "Aseguramiento de la calidad", d: "Jefe de Aseguramiento de la Calidad" },
  { s: "PRD", n: "Producción", d: "Gerente de Planta" },
  { s: "MTO", n: "Mantenimiento y metrología", d: "Jefe de Mantenimiento" },
  { s: "RHU", n: "Talento humano", d: "Jefe de Talento Humano" },
  { s: "LOG", n: "Logística y almacenamiento", d: "Coordinador de Logística" },
  { s: "COM", n: "Compras y comercial", d: "Jefe de Compras" },
  { s: "IDD", n: "Investigación y desarrollo", d: "Jefe de I+D" },
  { s: "SSA", n: "Seguridad, salud y ambiente", d: "Coordinador de SSA" },
];

const ROLES = ["Administrador", "Coordinador de calidad", "Dueño de proceso", "Colaborador", "Auditor externo"];
const ACCIONES = ["Crear", "Revisar", "Aprobar", "Publicar", "Modificar", "Obsoletar", "Consultar", "Descargar"];
const PERMISOS_INI = {
  "Administrador": [...ACCIONES],
  "Coordinador de calidad": ["Crear", "Revisar", "Publicar", "Modificar", "Obsoletar", "Consultar", "Descargar"],
  "Dueño de proceso": ["Crear", "Revisar", "Aprobar", "Modificar", "Consultar", "Descargar"],
  "Colaborador": ["Consultar"],
  "Auditor externo": ["Consultar"],
};

const CICLO = [
  { n: "Borrador", c: "#6B7C93", b: "#F1F4F8" },
  { n: "En revisión", c: "#E4A11B", b: "#FDF6E7" },
  { n: "Aprobado", c: "#27507F", b: "#EAF1F9" },
  { n: "Vigente", c: "#12A97F", b: "#E9FBF5" },
  { n: "En modificación", c: "#6C5CE7", b: "#EFEDFD" },
  { n: "Obsoleto", c: "#6B7C93", b: "#F1F4F8" },
  { n: "Archivado", c: "#12233A", b: "#EDEFF2" },
];

const TOKENS = {
  SIGLA: { label: "Sigla empresa", sample: (c) => c.empresa.sigla },
  TIPO: { label: "Tipo documental", sample: () => "PRO" },
  PROCESO: { label: "Proceso", sample: () => "CAL" },
  CORRELATIVO: { label: "Correlativo", sample: (c) => "1".padStart(c.cod.digitos, "0") },
  ANIO: { label: "Año", sample: () => "2026" },
  VERSION: { label: "Versión", sample: (c) => c.cod.prefijoVer + fmtVersion(c.ver.esquema, 3) },
};

const DEFAULT = {
  empresa: { nombre: "Industrias Solinal S.A.", sigla: "SOL", marca: "SOL" },
  normas: ["iso22000", "fssc"],
  perfil: { tamano: "Mediana", complejidad: "Alta", madurez: "En implementación", riesgos: "Altos", competencia: "Media", legal: "Exigentes", cliente: "Exigentes", evidencia: "Alta", remoto: "Deseable" },
  contenido: {
    alcance: true, politica: true, objetivos: true, manual: true, organigrama: true, mapa: true,
    procedimientos: true, flujos: false, especificaciones: true, comunicaciones: false,
    planes: true, formularios: true, externos: true, registros: true,
  },
  vista: "tipo",
  gap: {},
  flujos: { docs: true, auditoria: true, competencia: true, correctivas: true, revisionDireccion: false, cambios: true, compras: false, calibracion: false, riesgos: false, seguimiento: false },
  header: {
    tpl: "tripartito",
    campos: {
      logo: true, razonSocial: true, titulo: true, tipoDoc: true, proceso: true, codigo: true,
      version: true, fechaElaboracion: true, fechaRevision: true, fechaAprobacion: false,
      vigencia: true, proximaRevision: false, pagina: true, responsable: true, autor: true,
      objetivo: false, clasificacion: false, idioma: false, medio: false, estado: true,
    },
    bordes: "completo", repetir: true,
  },
  footer: {
    tpl: "firmasTabla", clasificacion: "Documento de uso interno",
    leyenda: "“COPIA NO CONTROLADA”: el departamento de Calidad no garantiza que esta impresión sea la última versión del documento.",
    qr: true, hash: false, impresion: true, mostrarCargo: true, mostrarFecha: true,
  },
  cod: { tokens: ["TIPO", "PROCESO", "CORRELATIVO", "VERSION"], separador: "-", digitos: 3, prefijoVer: "V", unico: true, hereda: true },
  tipos: TIPOS_INI,
  procesos: PROCESOS_INI,
  estructuras: Object.fromEntries(Object.entries(ESTRUCTURAS_INI).map(([k, v]) => [k, v.map((n) => ({ n, on: true }))])),
  ver: { esquema: "00", inicial: "01", formatoFecha: "DD/MM/AAAA", periodicidad: "12", alerta: 30, historial: true, obsoletoMarca: true },
  ctrl: {
    permisos: PERMISOS_INI, distribucion: "lista", acuse: true, copiasNumeradas: true, notifica: true,
    repositorio: "Nube Solinal (cifrado en reposo)", respaldo: "Diario", formato: "PDF/A + fuente editable",
    idioma: "Español (Ecuador)", bloqueoRegistros: true, bloqueoDescarga: false, bitacora: true,
    retencionDefault: "3 años", disposicion: "Archivo histórico digital", externos: true, retiroObsoletos: true,
    restauracion: "Semestral", obsolescencia: true, configuracion: true, versionAnterior: false,
    refsSinEstado: true, participacionDueno: true, cicloProducto: true, seguridadInfo: true,
  },
};

/* ================================================================
   Utilidades
   ================================================================ */

function fmtVersion(esquema, n) {
  if (esquema === "00") return String(n).padStart(2, "0");
  if (esquema === "n") return String(n);
  if (esquema === "mayor") return `${n}.0`;
  if (esquema === "letra") return String.fromCharCode(64 + n);
  if (esquema === "edicion") return `Edición N° ${n}`;
  return String(n);
}
function fmtFecha(f) {
  if (f === "DD/MM/AAAA") return "07/11/2026";
  if (f === "AAAA-MM-DD") return "2026-11-07";
  if (f === "MMM-AAAA") return "Nov-2026";
  return "07 de noviembre de 2026";
}
function joinCode(cfg, parts) {
  return parts.join(cfg.cod.separador === "ninguno" ? "" : cfg.cod.separador);
}
function buildCode(cfg, over = {}) {
  return joinCode(cfg, cfg.cod.tokens.map((t) => over[t] !== undefined ? over[t] : TOKENS[t].sample(cfg)));
}
const nivelOf = (cfg, sigla) => (cfg.tipos.find((t) => t.s === sigla) || { nivel: 3 }).nivel;
const nombreTipo = (cfg, s) => (cfg.tipos.find((t) => t.s === s) || { n: s }).n;
const nombreProc = (cfg, s) => (cfg.procesos.find((p) => p.s === s) || { n: s }).n;

/* ================================================================
   Átomos de interfaz
   ================================================================ */
const Toggle = ({ on, onClick }) => <button className={"toggle" + (on ? " on" : "")} onClick={onClick} aria-pressed={on}><i /></button>;
const Switch = ({ label, desc, on, set }) => (
  <div className="sw"><div><b>{label}</b>{desc && <small>{desc}</small>}</div><Toggle on={on} onClick={() => set(!on)} /></div>
);
const Field = ({ label, hint, children }) => (
  <div className="field"><label>{label}</label>{children}{hint && <small>{hint}</small>}</div>
);

const Mini = ({ kind }) => {
  const cell = (n = 2) => <div className="c">{Array.from({ length: n }).map((_, i) => <div className="b" key={i} style={{ width: i ? "70%" : "100%" }} />)}</div>;
  if (kind === "tripartito") return <div className="mini"><div className="r"><div className="c"><div className="sq" /></div>{cell(2)}{cell(3)}</div></div>;
  if (kind === "proceso") return <div className="mini"><div className="r"><div className="c"><div className="sq" /></div>{cell(1)}{cell(3)}</div><div className="r" style={{ flex: ".6" }}>{cell(1)}{cell(1)}{cell(1)}</div></div>;
  if (kind === "institucional") return <div className="mini"><div className="r"><div className="c"><div className="b" style={{ height: 9, background: "#D6455A" }} /></div><div className="c">{[0, 1, 2].map(i => <div className="b" key={i} style={{ width: i === 2 ? "60%" : "100%" }} />)}</div></div></div>;
  if (kind === "manual") return <div className="mini"><div className="r"><div className="c"><div className="sq" /></div>{cell(2)}<div className="c" style={{ flex: ".8" }}>{[0, 1, 2, 3].map(i => <div className="b" key={i} style={{ height: 3 }} />)}</div></div></div>;
  if (kind === "linea") return <div className="mini" style={{ justifyContent: "center", gap: 6 }}><div style={{ display: "flex", gap: 6, alignItems: "center" }}><div className="sq" /><div style={{ flex: 1 }}><div className="b" style={{ width: "80%" }} /><div className="b" style={{ width: "45%", marginTop: 3 }} /></div><div className="b" style={{ width: 30, height: 12 }} /></div><div style={{ height: 3, background: "#0F2A4A", borderRadius: 2 }} /></div>;
  if (kind === "firmasTabla") return <div className="mini"><div className="r">{cell(2)}{cell(2)}{cell(2)}</div></div>;
  if (kind === "firmasManuscritas") return <div className="mini" style={{ justifyContent: "flex-end" }}><div className="r" style={{ alignItems: "flex-end" }}>{[0, 1, 2].map(i => <div key={i} style={{ flex: 1 }}><div className="b" style={{ width: "60%", margin: "0 auto 3px" }} /><div style={{ height: 1, background: "#8494A8" }} /><div className="b" style={{ width: "80%", margin: "3px auto 0", height: 3 }} /></div>)}</div></div>;
  if (kind === "clasificacion") return <div className="mini"><div className="r">{cell(1)}{cell(2)}{cell(2)}{cell(2)}</div><div className="b" style={{ width: "70%", margin: "0 auto", height: 3 }} /></div>;
  if (kind === "barra") return <div className="mini" style={{ justifyContent: "flex-end" }}><div style={{ height: 2, background: "#25D0A0" }} /><div className="r" style={{ flex: ".5", alignItems: "center" }}><div className="b" style={{ width: "30%" }} /><div className="b" style={{ width: "30%" }} /><div className="b" style={{ width: "18%" }} /></div></div>;
  if (kind === "vigor") return <div className="mini"><div className="b" style={{ width: "55%" }} /><div className="r">{cell(1)}{cell(1)}</div></div>;
  return <div className="mini" />;
};

/* ================================================================
   Encabezado y pie del documento de ejemplo
   ================================================================ */

function Encabezado({ cfg, doc }) {
  const C = cfg.header.campos, E = cfg.empresa, soft = cfg.header.bordes !== "completo";
  const codigo = doc.codigo, ver = fmtVersion(cfg.ver.esquema, 3), fecha = fmtFecha(cfg.ver.formatoFecha);
  const logo = <div className="logo">{E.marca}</div>;
  const t = cfg.header.tpl;

  if (t === "linea") return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "2px 2px 10px" }}>
        {C.logo && <div className="logo sm">{E.marca}</div>}
        <div style={{ flex: 1 }}>
          {C.razonSocial && <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B7C93" }}>{E.nombre}</div>}
          {C.titulo && <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2A4A" }}>{doc.titulo}</div>}
          {C.proceso && <div style={{ fontSize: 9.5, color: "#6B7C93" }}>{nombreProc(cfg, doc.proceso)}{C.responsable && ` · ${doc.responsable}`}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 9, color: "#3D4C60", lineHeight: 1.7 }}>
          {C.codigo && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: "#0F2A4A" }}>{codigo}</div>}
          {C.version && <div>Versión {ver} {C.estado && <span className="pill">Vigente</span>}</div>}
          {C.vigencia && <div>Vigente desde {fecha}</div>}
          {C.pagina && <div>Página 1 de 8</div>}
        </div>
      </div>
      <div className="brandline" />
    </div>
  );

  if (t === "institucional") return (
    <table className={"doc" + (soft ? " soft" : "")}><tbody>
      <tr>
        <td rowSpan={3} style={{ width: "40%", textAlign: "center", padding: 14 }}>
          {C.logo && logo}{C.razonSocial && <div className="rs" style={{ marginTop: 8, fontSize: 15 }}>{E.nombre}</div>}
        </td>
        <td colSpan={4} className="ttl" style={{ fontSize: 13 }}>{C.tipoDoc ? nombreTipo(cfg, doc.tipo).toUpperCase() : "DOCUMENTO DEL SISTEMA"}</td>
      </tr>
      <tr><td colSpan={4} style={{ textAlign: "center", fontSize: 11 }}>{doc.titulo}</td></tr>
      <tr><td className="lbl">Código</td><td>{codigo}</td><td className="lbl">{cfg.ver.esquema === "edicion" ? "Edición" : "Versión"}</td><td>{ver}</td></tr>
    </tbody></table>
  );

  if (t === "manual") return (
    <table className={"doc" + (soft ? " soft" : "")}><tbody>
      <tr>
        <td rowSpan={2} style={{ width: 86, textAlign: "center" }}>{C.logo && logo}</td>
        <td className="ttl">MANUAL DEL SISTEMA DE GESTIÓN</td>
        <td style={{ width: 185, lineHeight: 1.5 }}>{C.codigo && <div>{codigo}</div>}{C.version && <div>N° {ver}: {fmtFecha("MMM-AAAA")}</div>}</td>
      </tr>
      <tr>
        <td className="ttl">{doc.titulo.toUpperCase()}</td>
        <td style={{ lineHeight: 1.6 }}>
          {C.fechaRevision && <div className="lbl">Actualización N° 4: {fmtFecha("MMM-AAAA")}</div>}
          {C.codigo && <div className="lbl">Código: {codigo}</div>}
          {C.pagina && <div className="lbl">Página 1 de 8</div>}
        </td>
      </tr>
    </tbody></table>
  );

  if (t === "proceso") return (
    <table className={"doc" + (soft ? " soft" : "")}><tbody>
      <tr>
        <td rowSpan={2} style={{ width: 88, textAlign: "center" }}>{C.logo && logo}</td>
        <td className="ttl" style={{ width: "40%" }}>PROCESO: {nombreProc(cfg, doc.proceso)}</td>
        <td style={{ width: "30%", lineHeight: 1.6 }}>
          {C.fechaElaboracion && <div><span className="lbl">Elaboración:</span> 08/09/2024</div>}
          {C.fechaRevision && <div><span className="lbl">Última modificación:</span> {fecha}</div>}
          {C.fechaAprobacion && <div><span className="lbl">Aprobación:</span> {fecha}</div>}
          {C.vigencia && <div><span className="lbl">Publicación:</span> {fecha}</div>}
        </td>
        <td style={{ width: 70, textAlign: "center", fontStyle: "italic", fontWeight: 700 }}>{C.pagina && <>Página<br />1 de 8</>}</td>
      </tr>
      <tr>
        <td><span className="lbl">Código:</span> {codigo}{C.version && <><br /><span className="lbl">Versión:</span> {ver}</>}</td>
        <td colSpan={2}><span className="lbl">{nombreTipo(cfg, doc.tipo).toUpperCase()}:</span> {doc.titulo}</td>
      </tr>
      {(C.responsable || C.autor) && <tr><td colSpan={4}>
        {C.responsable && <><span className="lbl">Cargo responsable:</span> {doc.responsable}</>}
        {C.autor && <> · <span className="lbl">Autor:</span> M. Mantilla</>}
        {C.idioma && <> · <span className="lbl">Idioma:</span> {cfg.ctrl.idioma}</>}
        {C.clasificacion && <> · <span className="lbl">Clasificación:</span> {cfg.footer.clasificacion}</>}
      </td></tr>}
      {C.objetivo && <tr><td colSpan={4} style={{ fontSize: 9.5 }}><span className="lbl">Objetivo:</span> {doc.objetivo}</td></tr>}
    </tbody></table>
  );

  return (
    <table className={"doc" + (soft ? " soft" : "")}><tbody>
      <tr>
        <td rowSpan={C.razonSocial ? 1 : 2} style={{ width: 116, textAlign: "center" }}>{C.logo && logo}</td>
        <td rowSpan={2} className="ttl" style={{ width: "46%" }}>
          {C.codigo && <div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{codigo}</div>}
          {C.titulo && <div style={{ marginTop: 6 }}>{doc.titulo.toUpperCase()}</div>}
          {C.proceso && <div style={{ fontWeight: 400, fontSize: 9.5, marginTop: 4 }}>Proceso: {nombreProc(cfg, doc.proceso)}</div>}
        </td>
        <td style={{ width: 160 }}><span className="lbl">{cfg.ver.esquema === "edicion" ? "Edición:" : "Versión:"}</span> {ver}</td>
      </tr>
      <tr>
        {C.razonSocial && <td className="rs">{E.nombre}</td>}
        <td>{C.vigencia && <><span className="lbl">Vigencia:</span> {fmtFecha("MMM-AAAA")}</>}</td>
      </tr>
      <tr>
        {C.razonSocial ? null : <td />}
        <td colSpan={C.razonSocial ? 2 : 1} style={{ fontSize: 9.5 }}>
          {C.responsable && <><span className="lbl">Responsable:</span> {doc.responsable}</>}
          {C.estado && <> · <span className="lbl">Estado:</span> Vigente</>}
          {C.proximaRevision && <> · <span className="lbl">Próxima revisión:</span> {fmtFecha("MMM-AAAA")}</>}
        </td>
        <td>{C.pagina && <><span className="lbl">Página:</span> 1 de 8</>}</td>
      </tr>
    </tbody></table>
  );
}

function PieDocumento({ cfg }) {
  const f = cfg.footer, soft = cfg.header.bordes !== "completo", fecha = fmtFecha(cfg.ver.formatoFecha);
  const gente = [
    { rol: "Elaboró", nom: "Magdalena Mantilla", cargo: "Coordinadora de Calidad" },
    { rol: "Revisó", nom: "Kathia Perea", cargo: "Jefe de Aseguramiento de la Calidad" },
    { rol: "Aprobó", nom: "Jorge Medina", cargo: "Director de Operaciones" },
  ];
  const legend = (
    <div className="legend">
      {f.leyenda}
      {f.impresion && <div>Impreso el 19/08/2026 · Válido únicamente el día de su impresión.</div>}
      {f.hash && <div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>SHA-256 8f3c…a91d · Sello de tiempo 2026-08-19T14:45Z</div>}
    </div>
  );

  if (f.tpl === "firmasManuscritas") return (
    <div>
      <div style={{ display: "flex", gap: 18, padding: "8px 6px 0" }}>
        {gente.map((g) => (
          <div key={g.rol} style={{ flex: 1 }}>
            <div className="sigline"><b>{g.rol} por:</b>{f.mostrarCargo && <div>{g.cargo}</div>}{f.mostrarFecha && <div style={{ color: "#6B7C93" }}>{fecha}</div>}</div>
          </div>
        ))}
        {f.qr && <div style={{ textAlign: "center" }}><div className="qr" /><div style={{ fontSize: 7.5, marginTop: 3 }}>Verificar<br />vigencia</div></div>}
      </div>
      {legend}
    </div>
  );

  if (f.tpl === "clasificacion") return (
    <div>
      <table className={"doc" + (soft ? " soft" : "")}><tbody>
        <tr>
          <td rowSpan={2} style={{ width: 108, textAlign: "center", fontWeight: 700, fontSize: 10.5 }}>{f.clasificacion}</td>
          {gente.map((g) => <td key={g.rol} className="lbl">{g.rol}: {g.nom}</td>)}
          {f.qr && <td rowSpan={2} style={{ width: 54, textAlign: "center" }}><div className="qr" style={{ margin: "0 auto" }} /></td>}
        </tr>
        <tr>{gente.map((g) => <td key={g.rol} className="lbl">Cargo: {g.cargo}</td>)}</tr>
      </tbody></table>
      {legend}
    </div>
  );

  if (f.tpl === "barra") return (
    <div>
      <div className="brandline" style={{ marginBottom: 7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 9, color: "#3D4C60" }}>
        <span>Versión {fmtVersion(cfg.ver.esquema, 3)}</span>
        <span>Vigente desde {fecha}</span>
        <span>{f.clasificacion}</span>
        <span style={{ marginLeft: "auto" }}>Página 1 de 8</span>
        {f.qr && <div className="qr" style={{ width: 28, height: 28 }} />}
      </div>
      {legend}
    </div>
  );

  if (f.tpl === "vigor") return (
    <div>
      <table className={"doc" + (soft ? " soft" : "")}><tbody>
        <tr><td colSpan={2} className="lbl">FECHA DE ENTRADA EN VIGOR: {fecha}</td></tr>
        <tr><td className="lbl" style={{ width: "50%" }}>Realizado por:</td><td className="lbl">Revisado y aprobado por:</td></tr>
        <tr>
          <td style={{ height: 48, verticalAlign: "bottom", fontSize: 9 }}>{f.mostrarCargo && "Coordinadora de Calidad"}</td>
          <td style={{ height: 48, verticalAlign: "bottom", fontSize: 9 }}>{f.mostrarCargo && "Director de Operaciones"}</td>
        </tr>
      </tbody></table>
      {legend}
    </div>
  );

  return (
    <div>
      <table className={"doc" + (soft ? " soft" : "")}><tbody>
        <tr>{gente.map((g) => <td key={g.rol} className="lbl" style={{ width: "33.3%" }}>{g.rol} por:</td>)}</tr>
        <tr>{gente.map((g) => <td key={g.rol}>{g.nom}{f.mostrarCargo && <div style={{ fontSize: 9, color: "#5A6B80" }}>{g.cargo}</div>}</td>)}</tr>
        <tr>{gente.map((g) => <td key={g.rol} style={{ height: 38, verticalAlign: "bottom", fontSize: 9, color: "#8494A8" }}>Firma</td>)}</tr>
        {f.mostrarFecha && <tr>{gente.map((g) => <td key={g.rol}><span className="lbl">Fecha:</span> {fecha}</td>)}</tr>}
      </tbody></table>
      {legend}
    </div>
  );
}

/* Hoja completa: encabezado + estructura del tipo documental + pie */
function Hoja({ cfg, doc, secciones }) {
  const secs = (secciones || []).filter((s) => s.on);
  return (
    <div className="previewWrap">
      <div className="sheet">
        <Encabezado cfg={cfg} doc={doc} />
        <div className="body">
          {secs.length === 0 && <div style={{ color: "#A9B6C6" }}>Sin secciones activas. Marca al menos una para construir el documento.</div>}
          {secs.map((s, i) => (
            <div key={s.n} style={{ marginBottom: 10 }}>
              <h4>{i + 1}. {s.n}</h4>
              <div className="ln" />
              {i % 3 === 0 && <div className="ln" />}
              <div className="ln s" />
            </div>
          ))}
        </div>
        <PieDocumento cfg={cfg} />
      </div>
    </div>
  );
}

/* ================================================================
   Aplicación
   ================================================================ */

export default function ControlDocumental() {
  const { state } = useAppState();
  const [cfg, setCfg] = useState(DEFAULT);
  const [tab, setTab] = useState("normas");
  const [tipoSel, setTipoSel] = useState("PRO");
  const [nuevaSec, setNuevaSec] = useState("");
  const [toast, setToast] = useState("");
  const [fProc, setFProc] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [vistaMaestro, setVistaMaestro] = useState("listado");

  const up = (path, value) => setCfg((c) => {
    const n = structuredClone(c); const k = path.split("."); let o = n;
    for (let i = 0; i < k.length - 1; i++) o = o[k[i]];
    o[k[k.length - 1]] = value; return n;
  });
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  /* ---- Motor: requisitos consolidados de las normas seleccionadas ---- */
  const requisitos = useMemo(() => {
    const map = new Map();
    NORMAS.filter((x) => cfg.normas.includes(x.id)).forEach((norma) => {
      norma.req.forEach(([cl, nombre, mc, tipo, proc]) => {
        const key = nombre.toLowerCase();
        if (map.has(key)) { const r = map.get(key); if (!r.normas.includes(norma.n)) { r.normas.push(norma.n); r.cl.push(`${norma.n} ${cl}`); } }
        else map.set(key, { nombre, mc, tipo, proc, normas: [norma.n], cl: [`${norma.n} ${cl}`] });
      });
    });
    return [...map.values()];
  }, [cfg.normas]);

  /* ---- Listado maestro generado ---- */
  const maestro = useMemo(() => {
    const cont = {};
    return requisitos
      .slice()
      .sort((a, b) => nivelOf(cfg, a.tipo) - nivelOf(cfg, b.tipo) || a.proc.localeCompare(b.proc))
      .map((r) => {
        const k = r.tipo + r.proc; cont[k] = (cont[k] || 0) + 1;
        const tipoDef = cfg.tipos.find((t) => t.s === r.tipo) || { digitos: 3, ret: cfg.ctrl.retencionDefault };
        const codigo = buildCode(cfg, {
          TIPO: r.tipo, PROCESO: r.proc,
          CORRELATIVO: String(cont[k]).padStart(tipoDef.digitos || cfg.cod.digitos, "0"),
          VERSION: cfg.cod.prefijoVer + fmtVersion(cfg.ver.esquema, 1),
        });
        return { ...r, codigo, nivel: nivelOf(cfg, r.tipo), retencion: tipoDef.ret };
      });
  }, [requisitos, cfg]);

  const maestroFiltrado = maestro.filter((d) =>
    (fProc === "todos" || d.proc === fProc) &&
    (fTipo === "todos" || d.tipo === fTipo) &&
    (busca.trim() === "" || d.nombre.toLowerCase().includes(busca.toLowerCase()) || d.codigo.toLowerCase().includes(busca.toLowerCase()))
  );
  const nMantener = maestro.filter((d) => d.mc === "M").length;
  const nConservar = maestro.length - nMantener;

  /* ---- Documento de ejemplo para las vistas previas ---- */
  const docEjemplo = useMemo(() => ({
    tipo: tipoSel,
    proceso: "CAL",
    titulo: tipoSel === "PRO" ? "Control de la información documentada" : `${nombreTipo(cfg, tipoSel)} de control de la información documentada`,
    responsable: "Jefe de Aseguramiento de la Calidad",
    objetivo: "Establecer los lineamientos para crear, identificar, revisar, aprobar, distribuir, conservar y dar de baja la información documentada del sistema de gestión.",
    codigo: buildCode(cfg, { TIPO: tipoSel }),
  }), [cfg, tipoSel]);

  const secciones = cfg.estructuras[tipoSel] || [];

  /* ---- Perfil documental · ISO 10013 4.1.1 ---- */
  const perfil = useMemo(() => {
    const max = FACTORES.reduce((s, f) => s + Math.max(...f.peso), 0);
    const val = FACTORES.reduce((s, f) => {
      const i = f.ops.indexOf(cfg.perfil[f.k]);
      return s + (i >= 0 ? f.peso[i] : 0);
    }, 0);
    const pc = Math.round((val / max) * 100);
    const nivel = pc < 35 ? "simplificada" : pc < 65 ? "intermedia" : "detallada";
    const texto = {
      simplificada: "Estructura simplificada: pocos documentos de nivel 1 y 2, apoyo en formatos y registros. Evita procedimientos donde la competencia del personal ya asegura el resultado.",
      intermedia: "Estructura intermedia: procedimientos para los procesos que cruzan áreas e instructivos solo donde la ausencia de instrucción afecta el resultado.",
      detallada: "Estructura detallada: procedimientos por proceso, instructivos por tarea crítica y evidencia amplia. Justificado por la complejidad, el marco legal y las exigencias del cliente.",
    }[nivel];
    return { pc, nivel, texto };
  }, [cfg.perfil]);

  /* ---- Análisis de carencias · ISO 10013 5.1.1 b) ---- */
  const gapDe = (nombre) => cfg.gap[nombre] || "falta";
  const setGap = (nombre, v) => setCfg((c) => ({ ...c, gap: { ...c.gap, [nombre]: v } }));
  const gapResumen = GAP.map((g) => ({ ...g, n: maestro.filter((d) => gapDe(d.nombre) === g.k).length }));

  /* ---- Cumplimiento 7.5 ---- */
  const checks = useMemo(() => {
    const C = cfg.header.campos;
    return [
      { cl: "7.5.1 a)", t: "Información documentada requerida por la norma", ok: cfg.normas.length > 0 && maestro.length > 0,
        d: `${cfg.normas.length} norma(s) seleccionada(s) generan ${maestro.length} elementos de información documentada.` },
      { cl: "7.5.1 b)", t: "La que la organización determina necesaria", ok: cfg.tipos.length >= 6,
        d: `${cfg.tipos.length} tipos documentales propios habilitados, con su nivel y retención.` },
      { cl: "7.5.2 a)", t: "Identificación y descripción", ok: C.codigo && C.titulo && C.version && (C.fechaElaboracion || C.vigencia) && (C.autor || C.responsable),
        d: "Título, código, fecha, autor o responsable, proceso y tipo documental en el encabezado." },
      { cl: "7.5.2 b)", t: "Formato y medios de soporte", ok: !!cfg.ctrl.formato && !!cfg.ctrl.idioma,
        d: `Idioma ${cfg.ctrl.idioma}, formato ${cfg.ctrl.formato}, plantilla y medio definidos en el módulo.` },
      { cl: "7.5.2 c)", t: "Revisión y aprobación", ok: cfg.footer.tpl !== "barra" || cfg.footer.hash,
        d: "El pie evidencia elaboró, revisó y aprobó, con cargos, fechas y estado del documento." },
      { cl: "7.5.3.1 a)", t: "Disponible e idónea donde se necesite", ok: cfg.ctrl.distribucion !== "ninguna" && cfg.ctrl.notifica,
        d: "Distribución y notificación de la versión vigente a la lista de acceso." },
      { cl: "7.5.3.1 b)", t: "Protegida adecuadamente", ok: cfg.ctrl.bloqueoRegistros && Object.values(cfg.ctrl.permisos).some((p) => p.length < ACCIONES.length),
        d: "Permisos diferenciados por rol y bloqueo de edición sobre lo aprobado." },
      { cl: "7.5.3.2 a)", t: "Distribución, acceso, recuperación y uso", ok: cfg.ctrl.acuse,
        d: "Acuse de recibo, búsqueda por código, proceso y norma, y copias controladas numeradas." },
      { cl: "7.5.3.2 b)", t: "Almacenamiento y preservación de la legibilidad", ok: !!cfg.ctrl.respaldo,
        d: `Repositorio ${cfg.ctrl.repositorio}, respaldo ${String(cfg.ctrl.respaldo).toLowerCase()} y formato de preservación.` },
      { cl: "7.5.3.2 c)", t: "Control de cambios y versiones", ok: cfg.ver.historial,
        d: "Historial de cambios embebido, versionado automático y estados del ciclo de vida." },
      { cl: "7.5.3.2 d)", t: "Conservación y disposición", ok: cfg.tipos.every((t) => !!t.ret),
        d: "Retención y disposición final por tipo documental." },
      { cl: "7.5.3.2", t: "Información documentada de origen externo", ok: cfg.ctrl.externos,
        d: "Nivel 5 habilitado con fuente, versión y verificación de vigencia." },
      { cl: "7.5.3.2", t: "Prevención del uso de documentos obsoletos", ok: cfg.ctrl.retiroObsoletos && cfg.ver.obsoletoMarca,
        d: "Retiro automático de la biblioteca, marca de agua OBSOLETO y QR que abre la versión vigente." },
      { cl: "7.5.3.2", t: "Protección de registros contra modificación no intencionada", ok: cfg.ctrl.bloqueoRegistros,
        d: "Los registros aprobados quedan en solo lectura con bitácora de accesos." },
    ];
  }, [cfg, maestro]);
  const pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  /* ---- Orientación ISO 10013:2021 ---- */
  const guias = useMemo(() => [
    { cl: "4.1.1", t: "El alcance de la documentación se basa en un análisis de los procesos", ok: true,
      d: `Perfil documental ${perfil.pc}% · estructura ${perfil.nivel} según tamaño, complejidad, madurez, riesgos, competencia y marco legal.` },
    { cl: "4.1.3", t: "Contenido de la información documentada", ok: Object.values(cfg.contenido).filter(Boolean).length >= 8,
      d: `${Object.values(cfg.contenido).filter(Boolean).length} de ${CONTENIDO_MINIMO.length} elementos del contenido habilitados.` },
    { cl: "Anexo A", t: "La estructura no está prescrita: se ordena y filtra según el uso", ok: true,
      d: `La biblioteca se organiza en ${VISTAS_A1.length} vistas alternativas sin imponer una jerarquía.` },
    { cl: "3.2 / 4.2.4.10", t: "El formulario se convierte en registro al completarse", ok: cfg.cod.hereda,
      d: "El formato se mantiene; al introducir datos genera un registro que se conserva con su propio correlativo." },
    { cl: "5.1.1", t: "Análisis de carencias antes de crear documentos", ok: Object.keys(cfg.gap).length > 0,
      d: "Compara lo existente con lo requerido y decide qué crear, qué mejorar y qué ya sirve." },
    { cl: "5.1.2", t: "Uso de referencias sin fijar el estado de revisión", ok: cfg.ctrl.refsSinEstado,
      d: "Las referencias cruzadas citan el código, no la versión: cambiar un documento no obliga a reeditar los que lo citan." },
    { cl: "5.1.3", t: "Responsabilidad de la creación con participación del dueño del proceso", ok: cfg.ctrl.participacionDueno,
      d: "Quien opera el proceso participa en la redacción: mejor comprensión y sentido de propiedad." },
    { cl: "5.1.4", t: "Identificador único acorde a la complejidad del sistema", ok: cfg.cod.unico && cfg.cod.tokens.length >= 2,
      d: `Regla de codificación ${buildCode(cfg)} con correlativo irrepetible.` },
    { cl: "5.2.2", t: "Reducción del riesgo de seguridad de la información", ok: cfg.ctrl.seguridadInfo,
      d: "Cifrado, permisos y controles alineados con ISO/IEC 27001 para el repositorio documental." },
    { cl: "5.2.3", t: "La revisión apropiada no siempre es la última", ok: true,
      d: cfg.ctrl.versionAnterior ? "Se permite autorizar el uso de una versión anterior para un fin definido, con registro del motivo." : "Solo circula la versión vigente. Puedes habilitar excepciones autorizadas si un producto en garantía lo exige." },
    { cl: "5.2.4", t: "Copia de seguridad, restauración y obsolescencia tecnológica", ok: !!cfg.ctrl.respaldo && cfg.ctrl.obsolescencia,
      d: `Respaldo ${String(cfg.ctrl.respaldo).toLowerCase()}, prueba de restauración ${String(cfg.ctrl.restauracion).toLowerCase()} y vigilancia del formato frente al cambio de software.` },
    { cl: "5.2.5", t: "Control de cambios y gestión de la configuración", ok: cfg.ver.historial && cfg.ctrl.configuracion,
      d: "Historial de cambios conservado como conocimiento e identificación de la configuración según ISO 10007." },
    { cl: "5.2.6", t: "Retención según cliente, normativa y ciclo de vida del producto", ok: cfg.ctrl.cicloProducto,
      d: `Retención por tipo documental y ajuste al ciclo de vida del producto o servicio prestado.` },
  ], [cfg, perfil]);
  const pctG = Math.round((guias.filter((c) => c.ok).length / guias.length) * 100);

  const TABS = [
    ["normas", "Normas y alcance"], ["perfil", "Perfil documental"], ["tipos", "Tipos y codificación"],
    ["estructura", "Estructuras documentales"], ["encabezado", "Encabezado"], ["pie", "Pie de página"],
    ["ciclo", "Ciclo de vida y versiones"], ["ctrl", "Acceso y conservación"], ["maestro", "Listado maestro"],
    ["comp", "Cumplimiento"],
  ];

  const HEADER_TPLS = [
    { id: "tripartito", n: "Tripartito clásico", d: "Logo · código y título · versión, vigencia y página." },
    { id: "proceso", n: "Proceso extendido", d: "Proceso, fechas de elaboración, modificación y publicación, autor y objetivo." },
    { id: "institucional", n: "Institucional", d: "Razón social a gran tamaño, tipo documental, título, código y edición." },
    { id: "manual", n: "Manual con actualización", d: "Documento padre y documento hijo, con edición y número de actualización." },
    { id: "linea", n: "Línea Solinal", d: "Sin tabla: jerarquía tipográfica, estado del documento y metadatos laterales." },
  ];
  const FOOTER_TPLS = [
    { id: "firmasTabla", n: "Firmas en tabla", d: "Elaboró, revisó y aprobó con nombre, cargo, firma y fecha." },
    { id: "firmasManuscritas", n: "Firmas manuscritas", d: "Tres líneas de firma con cargo debajo." },
    { id: "clasificacion", n: "Responsables y clasificación", d: "Nivel de confidencialidad, responsables y leyenda de copia no controlada." },
    { id: "barra", n: "Barra legal", d: "Una línea con versión, vigencia, clasificación y página. Firma electrónica." },
    { id: "vigor", n: "Entrada en vigor", d: "Fecha de entrada en vigor + realizado / revisado y aprobado." },
  ];

  const setSecs = (v) => up(`estructuras.${tipoSel}`, v);

  // Solo el Administrador configura el motor documental -- no solo el
  // Lector. El Sidebar ya oculta el link para todo el resto, pero esto
  // cubre navegación directa / cambio de rol estando ya en la página,
  // igual que en Plantillas.tsx/Auditoria.tsx/Configuracion.tsx.
  if (state.session.activeRole !== "Administrador") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Acceso restringido</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            El Control Documental está reservado al rol Administrador. Contacta
            a un administrador si necesitas cambios en el motor documental.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="cd">
      <style>{CSS}</style>

      {/* Own page chrome: real Sidebar/Topbar come from AppShell. */}
      <main className="main">
        <header className="top">
          <div>
            <h1>Control Documental</h1>
            <p>El motor que gobierna toda la información documentada: qué documentos exige tu sistema, cómo se codifican, qué estructura tiene cada tipo, cómo se identifican en el encabezado y quién puede crearlos, aprobarlos y darlos de baja.</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => flash("Configuración restablecida a los valores sugeridos.")}>Restablecer</button>
            <button className="btn pri" onClick={() => flash("Configuración guardada y aplicada a la biblioteca documental.")}>Guardar configuración</button>
            <button className="bell" aria-label="Notificaciones">🔔</button>
          </div>
        </header>
        <div className="rule" />

        <div className="tabs" role="tablist">
          {TABS.map(([k, l], i) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>{l}
            </button>
          ))}
        </div>

        {/* ============ 01 NORMAS Y ALCANCE ============ */}
        {tab === "normas" && (
          <>
            <div className="cdgrid w60">
              <div className="card">
                <span className="eyebrow">7.5.1 generalidades</span>
                <h3>Normas que aplica tu sistema de gestión</h3>
                <p className="hint">Marca los esquemas que la organización debe cumplir. Solinal calcula la información documentada que cada uno exige mantener o conservar y prepara el listado maestro.</p>
                <div className="norms">
                  {NORMAS.map((nm) => {
                    const on = cfg.normas.includes(nm.id);
                    return (
                      <button key={nm.id} className={"norm" + (on ? " on" : "")} aria-pressed={on}
                        onClick={() => up("normas", on ? cfg.normas.filter((x) => x !== nm.id) : [...cfg.normas, nm.id])}>
                        <div className="h"><span className="tick">{on ? "✓" : ""}</span><b>{nm.n}</b></div>
                        <small>{nm.d}</small>
                        <span className="cnt">{nm.req.length} elementos exigidos</span>
                      </button>
                    );
                  })}
                </div>

                <div className="banner">
                  <div className="big">{maestro.length}</div>
                  <p>{cfg.normas.length === 0
                    ? "Selecciona al menos una norma para calcular la información documentada de tu sistema."
                    : `Para este sistema de gestión hemos identificado ${maestro.length} tipos de información documentada que deben mantenerse o conservarse.`}</p>
                  <div className="mini3">
                    <div><b>{nMantener}</b><small>Mantener · documentos</small></div>
                    <div><b>{nConservar}</b><small>Conservar · registros</small></div>
                    <div><b>{new Set(maestro.map((d) => d.proc)).size}</b><small>Procesos implicados</small></div>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn sm" onClick={() => { setTab("maestro"); flash("Listado maestro generado a partir de las normas seleccionadas."); }}>Generar listado maestro</button>
                  </div>
                </div>
              </div>

              <div>
                <div className="card">
                  <span className="eyebrow b">Arquitectura del módulo</span>
                  <h3>Cómo decide Solinal</h3>
                  <p className="hint">Cada capa alimenta a la siguiente. La norma dice qué documentar, ISO 10013 orienta cómo, el numeral 7.5 fija lo obligatorio y la empresa pone el resto.</p>
                  <div className="arch">
                    <div className="layer hi"><span className="k">Base</span><div><b>ISO 10013:2021</b><small>Orientación para desarrollar y mantener la información documentada. No impone jerarquía: la estructura la decide la organización.</small></div></div>
                    <div className="layer"><span className="k">Regla</span><div><b>ISO 9001:2015 · 7.5</b><small>Lo innegociable: identificación, formato, revisión y aprobación, acceso, distribución, conservación y disposición.</small></div></div>
                    <div className="layer"><span className="k">Norma</span><div><b>Esquema seleccionado</b><small>Añade los documentos y registros propios: inocuidad, ambiente, SST o BPM.</small></div></div>
                    <div className="layer"><span className="k">Tipo</span><div><b>Tipo documental</b><small>Define la estructura recomendada de capítulos, editable por el administrador.</small></div></div>
                    <div className="layer"><span className="k">Empresa</span><div><b>Personalización</b><small>Logo, siglas, plantillas de encabezado y pie, codificación, roles y plazos de retención.</small></div></div>
                  </div>
                </div>

                <div className="card">
                  <h3>Identidad de la organización</h3>
                  <Field label="Razón social"><input className="in" value={cfg.empresa.nombre} onChange={(e) => up("empresa.nombre", e.target.value)} /></Field>
                  <div className="row2">
                    <Field label="Sigla"><input className="in" maxLength={5} value={cfg.empresa.sigla} onChange={(e) => up("empresa.sigla", e.target.value.toUpperCase())} /></Field>
                    <Field label="Marca del logo" hint="Sube el archivo PNG o SVG desde Ajustes."><input className="in" maxLength={4} value={cfg.empresa.marca} onChange={(e) => up("empresa.marca", e.target.value.toUpperCase())} /></Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3>Información documentada exigida</h3>
              <p className="hint">Detalle de lo que generan las normas marcadas. Puedes excluir un elemento si la organización justifica que no le aplica.</p>
              <div className="tblWrap">
                <table className="data" style={{ minWidth: 780 }}>
                  <thead><tr><th>Información documentada</th><th>Norma y cláusula</th><th>Se debe</th><th>Tipo sugerido</th><th>Proceso</th></tr></thead>
                  <tbody>
                    {requisitos.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>Aún no has seleccionado ninguna norma.</td></tr>}
                    {requisitos.map((r) => (
                      <tr key={r.nombre}>
                        <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                        <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.cl.join(" · ")}</td>
                        <td><span className="tag" style={{ background: r.mc === "M" ? "#EAF1F9" : "#E9FBF5", color: r.mc === "M" ? "#27507F" : "#12A97F" }}>{r.mc === "M" ? "Mantener" : "Conservar"}</span></td>
                        <td><span className="code">{r.tipo}</span></td>
                        <td style={{ fontSize: 12 }}>{nombreProc(cfg, r.proc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ============ PERFIL DOCUMENTAL ============ */}
        {tab === "perfil" && (
          <div className="cdgrid w60">
            <div>
              <div className="card">
                <span className="eyebrow b">ISO 10013:2021 · 4.1.1</span>
                <h3>¿Cuánta documentación necesita tu sistema?</h3>
                <p className="hint">Ninguna norma fija una cantidad. El tipo y el alcance de la información documentada se determinan analizando estos factores. Ajusta cada uno y Solinal recomienda el nivel de detalle.</p>
                <div className="factors">
                  {FACTORES.map((f) => (
                    <div className="factor" key={f.k}>
                      <b>{f.t}</b>
                      <select className="sel" value={cfg.perfil[f.k]} onChange={(e) => up(`perfil.${f.k}`, e.target.value)}>
                        {f.ops.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: 18, borderRadius: 12, background: "#F7F9FB", border: "1px solid var(--line)" }}>
                  <div className="bar"><i style={{ width: perfil.pc + "%" }} /></div>
                  <div className="gauge">
                    <span className="num">{perfil.pc}%</span>
                    <span className="txt"><b style={{ color: "var(--navy)" }}>Estructura {perfil.nivel}.</b> {perfil.texto}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <span className="eyebrow">ISO 10013:2021 · 4.1.3</span>
                <h3>Contenido de la información documentada</h3>
                <p className="hint">Los tres primeros y los registros son contenido base de cualquier sistema. El resto se incluye según corresponda; el manual, por ejemplo, ya no es obligatorio en ISO 9001, pero sigue siendo útil y varias normas de sector lo exigen.</p>
                <div className="secs">
                  {CONTENIDO_MINIMO.map((c) => (
                    <div className={"sec" + (cfg.contenido[c.k] ? "" : " off")} key={c.k}>
                      <input type="checkbox" checked={cfg.contenido[c.k]} disabled={c.fijo}
                        onChange={(e) => up(`contenido.${c.k}`, e.target.checked)} aria-label={c.t} />
                      <span className="nm">{c.t}{c.fijo && <span className="tag" style={{ marginLeft: 8, background: "#EAF1F9", color: "#27507F" }}>base</span>}</span>
                      <span className="num" style={{ width: "auto", fontSize: 10.5 }}>{c.cl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="card">
                <span className="eyebrow b">ISO 10013:2021 · Anexo A</span>
                <h3>Cómo se organiza la biblioteca</h3>
                <p className="hint">La norma no prescribe una jerarquía. Un sistema electrónico permite ver la misma información documentada ordenada y filtrada de varias maneras; elige la vista por defecto de tu organización.</p>
                <div className="lvls">
                  {VISTAS_A1.map((v) => (
                    <button key={v.k} className="lvl" style={{ textAlign: "left", cursor: "pointer", borderColor: cfg.vista === v.k ? "var(--navy)" : "var(--line)", background: cfg.vista === v.k ? "#F5F9FF" : "#FAFBFC" }}
                      onClick={() => up("vista", v.k)}>
                      <span className="no" style={{ background: cfg.vista === v.k ? "var(--mint-dk)" : "#C7D3E2" }}>{cfg.vista === v.k ? "✓" : ""}</span>
                      <div><b>{v.t}</b><small>{v.d}</small></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <span className="eyebrow">ISO 10013:2021 · 3.2 y 4.2.4.10</span>
                <h3>Del formato al registro</h3>
                <p className="hint">Un formulario es información documentada que se mantiene; cuando alguien lo completa, se convierte en un registro que se conserva. Solinal aplica esa transición automáticamente.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "6px 0 14px" }}>
                  <span className="code">{joinCode(cfg, ["FOR", "CAL", "007"])}</span>
                  <span className="tag" style={{ background: "#EAF1F9", color: "#27507F" }}>Se mantiene</span>
                  <span className="arrow">→ se completa →</span>
                  <span className="code">{joinCode(cfg, ["REG", "CAL", "0074"])}</span>
                  <span className="tag" style={{ background: "#E9FBF5", color: "#12A97F" }}>Se conserva</span>
                </div>
                <Switch label="Los registros heredan el código de su formato" on={cfg.cod.hereda} set={(v) => up("cod.hereda", v)} />
                <Switch label="El registro completado queda bloqueado para edición" on={cfg.ctrl.bloqueoRegistros} set={(v) => up("ctrl.bloqueoRegistros", v)} />
              </div>

              <div className="card">
                <h3>Por qué documentar</h3>
                <p className="hint">Propósito y beneficios que Solinal usa para justificar cada documento ante la dirección.</p>
                <div className="checks">
                  {["Comunicar información", "Evidenciar resultados y actividades", "Compartir conocimiento", "Preservar el conocimiento de la organización",
                    "Describir el sistema de gestión", "Demostrar cumplimiento legal y reglamentario", "Sustentar la competencia y la formación",
                    "Proporcionar requisitos a proveedores externos", "Dar base a la auditoría y a la evaluación de la eficacia"].map((t) => (
                      <label className="chk" key={t}><input type="checkbox" defaultChecked />{t}</label>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ 02 TIPOS Y CODIFICACIÓN ============ */}
        {tab === "tipos" && (
          <>
            <div className="card">
              <span className="eyebrow">7.5.2 a) identificación</span>
              <h3>Regla de codificación</h3>
              <p className="hint">Ordena los bloques del código. El correlativo es automático por tipo y proceso, y nunca se reutiliza.</p>
              <div className="tokens">
                {cfg.cod.tokens.map((t, i) => (
                  <span className="token" key={t}>
                    <button className="mv" onClick={() => { const a = [...cfg.cod.tokens]; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; up("cod.tokens", a); } }} aria-label="Mover">←</button>
                    {TOKENS[t].label}
                    <button className="mv" onClick={() => { const a = [...cfg.cod.tokens]; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; up("cod.tokens", a); } }} aria-label="Mover">→</button>
                    <button className="del" onClick={() => up("cod.tokens", cfg.cod.tokens.filter((x) => x !== t))} aria-label="Quitar">×</button>
                  </span>
                ))}
                {cfg.cod.tokens.length === 0 && <small style={{ color: "#6B7C93" }}>Agrega al menos un bloque.</small>}
              </div>
              <div className="chipbar">
                {Object.entries(TOKENS).map(([k, v]) => (
                  <button className="chip" key={k} disabled={cfg.cod.tokens.includes(k)} onClick={() => up("cod.tokens", [...cfg.cod.tokens, k])}>+ {v.label}</button>
                ))}
              </div>
              <div className="row2" style={{ marginTop: 16 }}>
                <Field label="Separador">
                  <select className="sel" value={cfg.cod.separador} onChange={(e) => up("cod.separador", e.target.value)}>
                    <option value="-">Guion · PRO-CAL-001-V03</option>
                    <option value=".">Punto · PRO.CAL.001</option>
                    <option value=":">Dos puntos · PO:GC:001</option>
                    <option value="_">Guion bajo · PRO_CAL_001</option>
                    <option value="ninguno">Sin separador · PROCAL001</option>
                  </select>
                </Field>
                {/* Solo tiene sentido elegir un prefijo de versión si VERSION
                    sigue siendo parte del código -- se oculta al quitarla. */}
                {cfg.cod.tokens.includes("VERSION") && (
                  <Field label="Prefijo de versión en el código">
                    <select className="sel" value={cfg.cod.prefijoVer} onChange={(e) => up("cod.prefijoVer", e.target.value)}>
                      {["V", "R", "Rev.", ""].map((p) => <option key={p} value={p}>{p === "" ? "Sin prefijo · 03" : `${p} · ${p}03`}</option>)}
                    </select>
                  </Field>
                )}
              </div>
              {/* Igual: los dígitos del correlativo no aplican si CORRELATIVO
                  no está en el código. */}
              {cfg.cod.tokens.includes("CORRELATIVO") && (
                <Field label="Dígitos del correlativo" hint="Cada tipo documental puede sobrescribir este valor en la tabla siguiente.">
                  <select className="sel" value={cfg.cod.digitos} onChange={(e) => up("cod.digitos", Number(e.target.value))}>
                    {[2, 3, 4].map((d) => <option key={d} value={d}>{d} dígitos · {"1".padStart(d, "0")}</option>)}
                  </select>
                </Field>
              )}
              <div className="result">
                <small>Código generado</small>
                <b>{buildCode(cfg) || "—"}</b>
                <div style={{ fontSize: 11.5, color: "#C7D9EA", marginTop: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
                  {joinCode(cfg, ["INS", "PRD", "014", cfg.cod.prefijoVer + "02"])} · {joinCode(cfg, ["FOR", "CAL", "007", cfg.cod.prefijoVer + "01"])}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Switch label="Códigos irrepetibles" desc="Un código retirado no se reasigna, aunque el documento se anule." on={cfg.cod.unico} set={(v) => up("cod.unico", v)} />
                <Switch label="Los formatos heredan el código de su documento padre" desc="El formato del procedimiento PRO-CAL-001 se codifica FOR-CAL-001-01." on={cfg.cod.hereda} set={(v) => up("cod.hereda", v)} />
              </div>
            </div>

            <div className="cdgrid">
              <div className="card">
                <h3>Tipos de información documentada</h3>
                <p className="hint">Sigla, longitud del correlativo y si exige firmas de revisión y aprobación.</p>
                <div className="tblWrap">
                  <table className="data" style={{ minWidth: 700 }}>
                    <thead><tr><th>Tipo</th><th>Sigla</th><th>Dígitos</th><th>Firmas</th><th>Ejemplo</th><th /></tr></thead>
                    <tbody>
                      {cfg.tipos.map((t, i) => (
                        <tr key={t.s + i}>
                          <td style={{ minWidth: 130 }}><input value={t.n} onChange={(e) => { const a = [...cfg.tipos]; a[i] = { ...t, n: e.target.value }; up("tipos", a); }} /></td>
                          <td style={{ width: 92 }}><input value={t.s} maxLength={7} onChange={(e) => { const a = [...cfg.tipos]; a[i] = { ...t, s: e.target.value.toUpperCase() }; up("tipos", a); }} /></td>
                          <td style={{ width: 66 }}>
                            <select value={t.digitos} onChange={(e) => { const a = [...cfg.tipos]; a[i] = { ...t, digitos: Number(e.target.value) }; up("tipos", a); }}>
                              {[2, 3, 4].map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" checked={t.firma} style={{ width: 16 }} onChange={(e) => { const a = [...cfg.tipos]; a[i] = { ...t, firma: e.target.checked }; up("tipos", a); }} /></td>
                          <td><span className="code">{buildCode(cfg, { TIPO: t.s, CORRELATIVO: "1".padStart(t.digitos, "0") })}</span></td>
                          <td><button className="del" onClick={() => up("tipos", cfg.tipos.filter((_, j) => j !== i))} aria-label="Eliminar">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn sm" style={{ marginTop: 12 }} onClick={() => { up("tipos", [...cfg.tipos, { s: "NUE", n: "Nuevo tipo", nivel: 3, digitos: 3, ret: "3 años", firma: false }]); }}>+ Agregar tipo</button>
              </div>

              <div className="card">
                <h3>Procesos y áreas</h3>
                <p className="hint">La sigla del proceso forma parte del código y determina el dueño del documento.</p>
                <div className="tblWrap">
                  <table className="data" style={{ minWidth: 560 }}>
                    <thead><tr><th>Proceso</th><th>Sigla</th><th>Dueño del proceso</th><th /></tr></thead>
                    <tbody>
                      {cfg.procesos.map((p, i) => (
                        <tr key={p.s + i}>
                          <td><input value={p.n} onChange={(e) => { const a = [...cfg.procesos]; a[i] = { ...p, n: e.target.value }; up("procesos", a); }} /></td>
                          <td style={{ width: 84 }}><input value={p.s} maxLength={4} onChange={(e) => { const a = [...cfg.procesos]; a[i] = { ...p, s: e.target.value.toUpperCase() }; up("procesos", a); }} /></td>
                          <td><input value={p.d} onChange={(e) => { const a = [...cfg.procesos]; a[i] = { ...p, d: e.target.value }; up("procesos", a); }} /></td>
                          <td><button className="del" onClick={() => up("procesos", cfg.procesos.filter((_, j) => j !== i))} aria-label="Eliminar">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn sm" style={{ marginTop: 12 }} onClick={() => up("procesos", [...cfg.procesos, { s: "NUE", n: "Nuevo proceso", d: "" }])}>+ Agregar proceso</button>
              </div>
            </div>
          </>
        )}

        {/* ============ 03 ESTRUCTURAS ============ */}
        {tab === "estructura" && (
          <div className="cdgrid">
            <div className="card">
              <span className="eyebrow b">ISO 10013:2021 · la estructura la define la organización</span>
              <h3>Estructura por tipo documental</h3>
              <p className="hint">Ninguna norma obliga a una plantilla única de capítulos. Estas son estructuras recomendadas: marca, desmarca, renombra o reordena, y el documento de ejemplo se reconstruye al instante.</p>
              <div className="typebar">
                {cfg.tipos.filter((t) => cfg.estructuras[t.s]).map((t) => (
                  <button key={t.s} className={tipoSel === t.s ? "on" : ""} onClick={() => setTipoSel(t.s)} title={t.n}>{t.s}</button>
                ))}
              </div>
              <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>
                {nombreTipo(cfg, tipoSel)} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· Nivel {nivelOf(cfg, tipoSel)} · {secciones.filter((s) => s.on).length} de {secciones.length} secciones activas</span>
              </div>
              <div className="secs">
                {secciones.map((s, i) => (
                  <div className={"sec" + (s.on ? "" : " off")} key={s.n + i}>
                    <input type="checkbox" checked={s.on} onChange={(e) => { const a = [...secciones]; a[i] = { ...s, on: e.target.checked }; setSecs(a); }} aria-label={s.n} />
                    <span className="num">{s.on ? secciones.slice(0, i + 1).filter((x) => x.on).length + "." : "—"}</span>
                    <input className="nm" style={{ border: "1px solid transparent", background: "transparent", padding: "4px 6px", borderRadius: 6 }}
                      value={s.n} onChange={(e) => { const a = [...secciones]; a[i] = { ...s, n: e.target.value }; setSecs(a); }} />
                    <button className="mv" onClick={() => { if (i > 0) { const a = [...secciones];[a[i - 1], a[i]] = [a[i], a[i - 1]]; setSecs(a); } }} aria-label="Subir">↑</button>
                    <button className="mv" onClick={() => { if (i < secciones.length - 1) { const a = [...secciones];[a[i + 1], a[i]] = [a[i], a[i + 1]]; setSecs(a); } }} aria-label="Bajar">↓</button>
                    <button className="del" onClick={() => setSecs(secciones.filter((_, j) => j !== i))} aria-label="Eliminar">×</button>
                  </div>
                ))}
              </div>
              <div className="addsec">
                <input className="in" placeholder="Nombre de la nueva sección" value={nuevaSec} onChange={(e) => setNuevaSec(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nuevaSec.trim()) { setSecs([...secciones, { n: nuevaSec.trim(), on: true }]); setNuevaSec(""); } }} />
                <button className="btn sm" onClick={() => { if (nuevaSec.trim()) { setSecs([...secciones, { n: nuevaSec.trim(), on: true }]); setNuevaSec(""); } }}>Agregar</button>
              </div>
              <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
                Al crear un documento de tipo {tipoSel}, Solinal genera el archivo con estas secciones ya numeradas y con el encabezado y pie configurados.
              </p>
            </div>

            <div className="stick">
              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ padding: "6px 6px 0" }}>Documento de ejemplo</h3>
                <p className="hint" style={{ padding: "0 6px" }}>{nombreTipo(cfg, tipoSel)} · {docEjemplo.codigo}</p>
                <Hoja cfg={cfg} doc={docEjemplo} secciones={secciones} />
              </div>
            </div>
          </div>
        )}

        {/* ============ 04 ENCABEZADO ============ */}
        {tab === "encabezado" && (
          <div className="cdgrid">
            <div>
              <div className="card">
                <span className="eyebrow">7.5.2 a) y b) · metadatos documentales</span>
                <h3>Plantilla de encabezado</h3>
                <p className="hint">El encabezado transporta los metadatos que identifican el documento. Es distinto de la estructura de capítulos, que se define por tipo documental.</p>
                <div className="picker">
                  {HEADER_TPLS.map((t) => (
                    <button key={t.id} className={"tpl" + (cfg.header.tpl === t.id ? " on" : "")} onClick={() => up("header.tpl", t.id)}>
                      <Mini kind={t.id} /><div className="name"><span className="dot" />{t.n}</div><div className="desc">{t.d}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>Identificación y descripción</h3>
                <p className="hint">Lo mínimo que exige el numeral 7.5.2 a): título, código, fecha, autor o responsable, proceso y tipo documental.</p>
                <div className="checks">
                  {[["titulo", "Título"], ["codigo", "Código"], ["version", "Versión o edición"], ["fechaElaboracion", "Fecha de elaboración"],
                  ["fechaRevision", "Fecha de última modificación"], ["fechaAprobacion", "Fecha de aprobación"], ["autor", "Autor"],
                  ["responsable", "Cargo responsable"], ["proceso", "Proceso"], ["tipoDoc", "Tipo documental"]].map(([k, l]) => (
                    <label className="chk" key={k}><input type="checkbox" checked={cfg.header.campos[k]} onChange={(e) => up(`header.campos.${k}`, e.target.checked)} />{l}</label>
                  ))}
                </div>
                <h3 style={{ marginTop: 20 }}>Formato y medio</h3>
                <div className="checks">
                  {[["idioma", "Idioma"], ["medio", "Medio de soporte"], ["clasificacion", "Clasificación"], ["objetivo", "Objetivo"],
                  ["logo", "Logo"], ["razonSocial", "Razón social"]].map(([k, l]) => (
                    <label className="chk" key={k}><input type="checkbox" checked={cfg.header.campos[k]} onChange={(e) => up(`header.campos.${k}`, e.target.checked)} />{l}</label>
                  ))}
                </div>
                <h3 style={{ marginTop: 20 }}>Estado y vigencia</h3>
                <div className="checks">
                  {[["estado", "Estado del documento"], ["vigencia", "Fecha de vigencia"], ["proximaRevision", "Próxima revisión"], ["pagina", "Página X de Y"]].map(([k, l]) => (
                    <label className="chk" key={k}><input type="checkbox" checked={cfg.header.campos[k]} onChange={(e) => up(`header.campos.${k}`, e.target.checked)} />{l}</label>
                  ))}
                </div>
                <div className="row2" style={{ marginTop: 18 }}>
                  <Field label="Bordes">
                    <select className="sel" value={cfg.header.bordes} onChange={(e) => up("header.bordes", e.target.value)}>
                      <option value="completo">Tabla con borde completo</option><option value="suave">Tabla con líneas suaves</option>
                    </select>
                  </Field>
                  <Field label="Repetición">
                    <select className="sel" value={cfg.header.repetir ? "si" : "no"} onChange={(e) => up("header.repetir", e.target.value === "si")}>
                      <option value="si">Repetir en todas las páginas</option><option value="no">Solo en la primera página</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <div className="stick">
              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ padding: "6px 6px 0" }}>Vista previa</h3>
                <p className="hint" style={{ padding: "0 6px" }}>{nombreTipo(cfg, tipoSel)} con la estructura activa.</p>
                <Hoja cfg={cfg} doc={docEjemplo} secciones={secciones.slice(0, 4)} />
              </div>
            </div>
          </div>
        )}

        {/* ============ 05 PIE ============ */}
        {tab === "pie" && (
          <div className="cdgrid">
            <div>
              <div className="card">
                <span className="eyebrow">7.5.2 c) revisión y aprobación</span>
                <h3>Plantilla de pie de página</h3>
                <p className="hint">Aquí se evidencia quién elaboró, revisó y aprobó, y la advertencia que impide trabajar con copias caducadas.</p>
                <div className="picker">
                  {FOOTER_TPLS.map((t) => (
                    <button key={t.id} className={"tpl" + (cfg.footer.tpl === t.id ? " on" : "")} onClick={() => up("footer.tpl", t.id)}>
                      <Mini kind={t.id} /><div className="name"><span className="dot" />{t.n}</div><div className="desc">{t.d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3>Contenido del pie</h3>
                <Field label="Clasificación de confidencialidad">
                  <select className="sel" value={cfg.footer.clasificacion} onChange={(e) => up("footer.clasificacion", e.target.value)}>
                    {["Documento de uso interno", "Documento público", "Confidencial", "Restringido"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Leyenda para impresiones">
                  <textarea className="ta" rows={3} value={cfg.footer.leyenda} onChange={(e) => up("footer.leyenda", e.target.value)} />
                </Field>
                <Switch label="Mostrar cargo junto al nombre" on={cfg.footer.mostrarCargo} set={(v) => up("footer.mostrarCargo", v)} />
                <Switch label="Mostrar fecha de firma" on={cfg.footer.mostrarFecha} set={(v) => up("footer.mostrarFecha", v)} />
                <Switch label="Código QR de verificación" desc="Abre la versión vigente en Solinal: nadie trabaja con una copia obsoleta." on={cfg.footer.qr} set={(v) => up("footer.qr", v)} />
                <Switch label="Huella digital y sello de tiempo" desc="Hash SHA-256 del archivo aprobado para detectar modificaciones no intencionadas." on={cfg.footer.hash} set={(v) => up("footer.hash", v)} />
                <Switch label="Fecha y hora de impresión" on={cfg.footer.impresion} set={(v) => up("footer.impresion", v)} />
              </div>
              <div className="card">
                <h3>Flujo de firmas</h3>
                <p className="hint">Solinal solicita las firmas en este orden y no publica el documento hasta completarlas. La liberación la autoriza personal facultado y la evidencia de aprobación se conserva.</p>
                <Switch label="La redacción exige participación del dueño del proceso" desc="Quien opera el proceso interviene en el documento: mejor comprensión y sentido de propiedad." on={cfg.ctrl.participacionDueno} set={(v) => up("ctrl.participacionDueno", v)} />
                <div className="tblWrap">
                  <table className="data" style={{ minWidth: 420 }}>
                    <thead><tr><th>Etapa</th><th>Rol que firma</th><th>Obligatoria</th></tr></thead>
                    <tbody>
                      {[["Elaboró", "Dueño de proceso"], ["Revisó", "Coordinador de calidad"], ["Aprobó", "Alta dirección"]].map(([e, r]) => (
                        <tr key={e}>
                          <td style={{ fontWeight: 600 }}>{e}</td>
                          <td><select defaultValue={r}>{["Dueño de proceso", "Coordinador de calidad", "Alta dirección", "Administrador"].map((o) => <option key={o}>{o}</option>)}</select></td>
                          <td><input type="checkbox" defaultChecked style={{ width: 16 }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="stick">
              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ padding: "6px 6px 0" }}>Vista previa</h3>
                <Hoja cfg={cfg} doc={docEjemplo} secciones={secciones.slice(0, 4)} />
              </div>
            </div>
          </div>
        )}

        {/* ============ 06 CICLO DE VIDA ============ */}
        {tab === "ciclo" && (
          <div className="cdgrid">
            <div>
              <div className="card">
                <span className="eyebrow">7.5.3.2 c) control de cambios</span>
                <h3>Declaración de versiones</h3>
                <Field label="Esquema de numeración">
                  <select className="sel" value={cfg.ver.esquema} onChange={(e) => up("ver.esquema", e.target.value)}>
                    <option value="00">Secuencial de dos dígitos · 01, 02, 03</option>
                    <option value="n">Secuencial simple · 1, 2, 3</option>
                    <option value="mayor">Mayor.menor · 1.0, 1.1, 2.0</option>
                    <option value="letra">Alfabético · A, B, C</option>
                    <option value="edicion">Edición y actualización · Edición N° 3</option>
                  </select>
                </Field>
                <div className="row2">
                  <Field label="Versión inicial"><input className="in" value={cfg.ver.inicial} onChange={(e) => up("ver.inicial", e.target.value)} /></Field>
                  <Field label="Formato de fecha">
                    <select className="sel" value={cfg.ver.formatoFecha} onChange={(e) => up("ver.formatoFecha", e.target.value)}>
                      {["DD/MM/AAAA", "AAAA-MM-DD", "MMM-AAAA", "texto"].map((o) => <option key={o} value={o}>{o === "texto" ? "07 de noviembre de 2026" : o}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4].map((n) => <span className="code" key={n}>{fmtVersion(cfg.ver.esquema, n)}</span>)}
                </div>
              </div>

              <div className="card">
                <h3>Ciclo de vida del documento</h3>
                <p className="hint">Cada transición queda en la bitácora con usuario, fecha y motivo. Un documento solo es exigible cuando está vigente.</p>
                <div className="states">
                  {CICLO.map((s, i) => (
                    <React.Fragment key={s.n}>
                      <span className="state" style={{ color: s.c, background: s.b }}>{s.n}</span>
                      {i < CICLO.length - 1 && <span className="arrow">→</span>}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 18 }}>
                  <Switch label="Historial de cambios dentro del documento" desc="Tabla final con versión, fecha, descripción del cambio y responsable." on={cfg.ver.historial} set={(v) => up("ver.historial", v)} />
                  <Switch label="Marca de agua OBSOLETO en versiones anteriores" desc="La versión anterior se conserva como evidencia sin poder confundirse con la vigente." on={cfg.ver.obsoletoMarca} set={(v) => up("ver.obsoletoMarca", v)} />
                  <Switch label="Retirar de la biblioteca al publicar una nueva versión" desc="El documento obsoleto sale de circulación automáticamente." on={cfg.ctrl.retiroObsoletos} set={(v) => up("ctrl.retiroObsoletos", v)} />
                </div>
              </div>

              <div className="card">
                <h3>Vigencia y revisión</h3>
                <div className="row2">
                  <Field label="Periodicidad de revisión">
                    <select className="sel" value={cfg.ver.periodicidad} onChange={(e) => up("ver.periodicidad", e.target.value)}>
                      {[["6", "Cada 6 meses"], ["12", "Cada 12 meses"], ["24", "Cada 24 meses"], ["36", "Cada 36 meses"], ["evento", "Solo por cambio o evento"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Avisar al responsable">
                    <select className="sel" value={cfg.ver.alerta} onChange={(e) => up("ver.alerta", Number(e.target.value))}>
                      {[15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} días antes</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <div>
              <div className="card">
                <span className="eyebrow b">Gobernanza documental</span>
                <h3>Quién puede hacer qué</h3>
                <p className="hint">El acceso puede limitarse a consultar o incluir la autoridad para modificar. Esta matriz es la que aplica Solinal en cada transición del ciclo de vida.</p>
                <div className="tblWrap">
                  <table className="data matrix" style={{ minWidth: 720 }}>
                    <thead><tr><th>Rol</th>{ACCIONES.map((a) => <th key={a} style={{ textAlign: "center" }}>{a}</th>)}</tr></thead>
                    <tbody>
                      {ROLES.map((r) => (
                        <tr key={r}>
                          <td className="rl">{r}</td>
                          {ACCIONES.map((a) => (
                            <td className="ck" key={a}>
                              <input type="checkbox" checked={cfg.ctrl.permisos[r].includes(a)}
                                onChange={(e) => { const cur = cfg.ctrl.permisos[r]; up(`ctrl.permisos.${r}`, e.target.checked ? [...cur, a] : cur.filter((x) => x !== a)); }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <span className="eyebrow b">ISO 10013 · 4.2.4.6</span>
                <h3>Flujos de trabajo automatizados</h3>
                <p className="hint">Un flujo automatizado encadena formulario digital, revisión, aprobación, notificación, trazabilidad y conservación. Marca los procesos que Solinal debe automatizar.</p>
                <div className="checks">
                  {FLUJOS_AUTO.map(([k, l]) => (
                    <label className="chk" key={k}>
                      <input type="checkbox" checked={cfg.flujos[k]} onChange={(e) => up(`flujos.${k}`, e.target.checked)} />{l}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                  {["Formulario digital", "Revisión", "Aprobación", "Notificación", "Trazabilidad", "Conservación"].map((p, i, a) => (
                    <React.Fragment key={p}>
                      <span className="tag" style={{ background: "#EAF1F9", color: "#27507F" }}>{p}</span>
                      {i < a.length - 1 && <span className="arrow">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="card">
                <span className="eyebrow b">ISO 10013 · 5.1.2 y 5.2.5</span>
                <h3>Referencias y configuración</h3>
                <Switch label="Las referencias cruzadas no fijan el estado de revisión" desc="Se cita el código, no la versión: actualizar un documento no obliga a reeditar los que lo mencionan." on={cfg.ctrl.refsSinEstado} set={(v) => up("ctrl.refsSinEstado", v)} />
                <Switch label="Identificación de la configuración" desc="Vincula cada versión del documento con la versión del producto o proceso que describe, según ISO 10007." on={cfg.ctrl.configuracion} set={(v) => up("ctrl.configuracion", v)} />
              </div>

              <div className="card">
                <h3>Historial de cambios</h3>
                <p className="hint">Así se verá la tabla que se agrega al final del documento.</p>
                <div className="tblWrap">
                  <table className="data" style={{ minWidth: 470 }}>
                    <thead><tr><th>Versión</th><th>Fecha</th><th>Descripción del cambio</th><th>Elaboró</th></tr></thead>
                    <tbody>
                      {[[3, "Se incorpora el acuse de recibo y se actualiza el flujo de aprobación."],
                      [2, "Se agrega el criterio de clasificación de documentos externos."],
                      [1, "Emisión inicial del documento."]].map(([n, d]) => (
                        <tr key={n}>
                          <td><span className="code">{fmtVersion(cfg.ver.esquema, n)}</span></td>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtFecha(cfg.ver.formatoFecha)}</td>
                          <td style={{ fontSize: 12 }}>{d}</td>
                          <td style={{ fontSize: 12 }}>M. Mantilla</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 16, padding: 14, background: "#F7F9FB", borderRadius: 11, fontSize: 12.5, color: "#3D4C60", lineHeight: 1.6 }}>
                  <b style={{ color: "#0F2A4A" }}>Vencimiento</b>
                  <div style={{ marginTop: 6 }}>Aprobado el {fmtFecha(cfg.ver.formatoFecha)} · Próxima revisión {cfg.ver.periodicidad === "evento" ? "por evento" : `en ${cfg.ver.periodicidad} meses`} · Aviso {cfg.ver.alerta} días antes al dueño del proceso.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ 07 ACCESO Y CONSERVACIÓN ============ */}
        {tab === "ctrl" && (
          <div className="cdgrid">
            <div>
              <div className="card">
                <span className="eyebrow">7.5.3.2 a) distribución, acceso, recuperación y uso</span>
                <h3>Distribución</h3>
                <Field label="Modo de distribución">
                  <select className="sel" value={cfg.ctrl.distribucion} onChange={(e) => up("ctrl.distribucion", e.target.value)}>
                    <option value="lista">Lista de distribución por documento</option>
                    <option value="proceso">Automática al proceso dueño</option>
                    <option value="abierta">Abierta a toda la organización</option>
                    <option value="ninguna">Sin distribución (solo consulta a demanda)</option>
                  </select>
                </Field>
                <Switch label="Notificar cada nueva versión publicada" on={cfg.ctrl.notifica} set={(v) => up("ctrl.notifica", v)} />
                <Switch label="Exigir acuse de recibo" desc="El colaborador confirma que leyó la versión vigente: evidencia de socialización." on={cfg.ctrl.acuse} set={(v) => up("ctrl.acuse", v)} />
                <Switch label="Numerar las copias controladas impresas" desc="Copia controlada N° 1 de 5, con destinatario asignado." on={cfg.ctrl.copiasNumeradas} set={(v) => up("ctrl.copiasNumeradas", v)} />
              </div>

              <div className="card">
                <span className="eyebrow">7.5.3.1 b) protección</span>
                <h3>Protección de la información</h3>
                <Switch label="Registros aprobados en solo lectura" desc="La evidencia queda protegida contra modificaciones no intencionadas." on={cfg.ctrl.bloqueoRegistros} set={(v) => up("ctrl.bloqueoRegistros", v)} />
                <Switch label="Bitácora de accesos, descargas e impresiones" on={cfg.ctrl.bitacora} set={(v) => up("ctrl.bitacora", v)} />
                <Switch label="Bloquear la descarga de documentos confidenciales" desc="Solo lectura en pantalla con marca de agua personal del usuario." on={cfg.ctrl.bloqueoDescarga} set={(v) => up("ctrl.bloqueoDescarga", v)} />
                <Switch label="Controles de seguridad de la información" desc="Cifrado, autenticación y gestión de accesos alineados con ISO/IEC 27001." on={cfg.ctrl.seguridadInfo} set={(v) => up("ctrl.seguridadInfo", v)} />
              </div>

              <div className="card">
                <span className="eyebrow b">ISO 10013 · 5.2.3</span>
                <h3>Uso de una versión anterior</h3>
                <p className="hint">La revisión apropiada no siempre es la última: un producto en garantía o un lote ya liberado puede exigir la versión con la que se fabricó.</p>
                <Switch label="Permitir versiones anteriores autorizadas" desc="Requiere autorización nominal, fin declarado y fecha de caducidad del permiso; queda en la bitácora." on={cfg.ctrl.versionAnterior} set={(v) => up("ctrl.versionAnterior", v)} />
                {cfg.ctrl.versionAnterior && (
                  <div className="tblWrap" style={{ marginTop: 12 }}>
                    <table className="data" style={{ minWidth: 460 }}>
                      <thead><tr><th>Documento</th><th>Versión</th><th>Motivo autorizado</th><th>Hasta</th></tr></thead>
                      <tbody>
                        <tr><td><span className="code">{joinCode(cfg, ["ESP", "PRD", "004"])}</span></td><td>02</td><td>Lote en garantía fabricado con esa especificación</td><td>31/12/2026</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="card">
                <span className="eyebrow">7.5.3.2 b) almacenamiento y preservación</span>
                <h3>Almacenamiento y legibilidad</h3>
                <div className="row2">
                  <Field label="Repositorio"><input className="in" value={cfg.ctrl.repositorio} onChange={(e) => up("ctrl.repositorio", e.target.value)} /></Field>
                  <Field label="Respaldo">
                    <select className="sel" value={cfg.ctrl.respaldo} onChange={(e) => up("ctrl.respaldo", e.target.value)}>
                      {["Diario", "Semanal", "Mensual"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="row2">
                  <Field label="Idioma oficial del sistema">
                    <select className="sel" value={cfg.ctrl.idioma} onChange={(e) => up("ctrl.idioma", e.target.value)}>
                      {["Español (Ecuador)", "Español (neutro)", "Español e inglés", "Inglés"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Formato de conservación" hint="El formato de preservación asegura la legibilidad a diez años.">
                    <select className="sel" value={cfg.ctrl.formato} onChange={(e) => up("ctrl.formato", e.target.value)}>
                      {["PDF/A + fuente editable", "Solo PDF/A", "Formato nativo (Word, Excel)", "PDF firmado electrónicamente"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Prueba de restauración del respaldo" hint="Un respaldo que nunca se restaura no es un respaldo.">
                  <select className="sel" value={cfg.ctrl.restauracion} onChange={(e) => up("ctrl.restauracion", e.target.value)}>
                    {["Trimestral", "Semestral", "Anual"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Switch label="Vigilar la obsolescencia tecnológica" desc="Revisa que el hardware y el software sigan abriendo los documentos conservados durante todo su plazo de retención." on={cfg.ctrl.obsolescencia} set={(v) => up("ctrl.obsolescencia", v)} />
              </div>

              <div className="card">
                <span className="eyebrow">7.5.3.2 d) conservación y disposición</span>
                <h3>Retención y disposición final</h3>
                <div className="row2">
                  <Field label="Retención por defecto" hint="Cada tipo documental puede tener su propio plazo.">
                    <select className="sel" value={cfg.ctrl.retencionDefault} onChange={(e) => up("ctrl.retencionDefault", e.target.value)}>
                      {["1 año", "3 años", "5 años", "10 años", "Permanente"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Disposición al vencer">
                    <select className="sel" value={cfg.ctrl.disposicion} onChange={(e) => up("ctrl.disposicion", e.target.value)}>
                      {["Archivo histórico digital", "Eliminación segura con acta", "Devolución al cliente", "Conservación indefinida"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <Switch label="Ajustar la retención al ciclo de vida del producto" desc="Los registros de un lote se conservan al menos hasta el fin de su vida útil más el plazo legal o contractual." on={cfg.ctrl.cicloProducto} set={(v) => up("ctrl.cicloProducto", v)} />
              </div>

              <div className="card">
                <span className="eyebrow">Nivel 5 · origen externo</span>
                <h3>Documentos externos</h3>
                <Switch label="Controlar documentos de origen externo" desc="Normas, leyes, fichas de proveedor y requisitos de cliente, con fuente y verificación de vigencia." on={cfg.ctrl.externos} set={(v) => up("ctrl.externos", v)} />
                {cfg.ctrl.externos && (
                  <div className="tblWrap" style={{ marginTop: 12 }}>
                    <table className="data" style={{ minWidth: 560 }}>
                      <thead><tr><th>Código</th><th>Documento</th><th>Fuente</th><th>Versión</th><th>Vigencia verificada</th></tr></thead>
                      <tbody>
                        {[["001", "NTE INEN-ISO 9001", "INEN", "2015", "12/02/2026"],
                        ["002", "Codex Alimentarius CXS 192", "FAO/OMS", "Rev. 2025", "03/06/2026"],
                        ["003", "Reglamento de BPM ARCSA", "ARCSA", "2022", "15/01/2026"],
                        ["004", "Ficha técnica de proveedor", "Proveedor", "v2", "28/07/2026"]].map(([c, d, f, v, fv]) => (
                          <tr key={c}>
                            <td><span className="code">{joinCode(cfg, ["DOC-EXT", "CAL", c])}</span></td>
                            <td>{d}</td><td>{f}</td><td>{v}</td><td>{fv}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ 08 LISTADO MAESTRO ============ */}
        {tab === "maestro" && (
          <div className="cdgrid one">
            <div className="card">
              <span className="eyebrow">7.5.3 · listado maestro generado</span>
              <h3>Listado maestro de información documentada</h3>
              <p className="hint">
                {maestro.length} elementos derivados de {cfg.normas.length} norma(s): {NORMAS.filter((n) => cfg.normas.includes(n.id)).map((n) => n.n).join(" · ") || "ninguna"}.
                Los códigos se generan con tu regla de codificación y los correlativos se asignan por tipo y proceso.
              </p>
              <div className="kpis">
                <div className="kpi"><b>{maestro.length}</b><small>Elementos</small></div>
                {gapResumen.map((g) => (
                  <div className="kpi" key={g.k} style={{ borderColor: g.b, background: g.b }}>
                    <b style={{ color: g.c }}>{g.n}</b><small style={{ color: g.c }}>{g.t}</small>
                  </div>
                ))}
              </div>
              <div className="seg" style={{ marginBottom: 14 }}>
                {[["listado", "Listado maestro"], ["gap", "Análisis de carencias"], ["vistas", "Vistas de la biblioteca"]].map(([k, l]) => (
                  <button key={k} className={vistaMaestro === k ? "on" : ""} onClick={() => setVistaMaestro(k)}>{l}</button>
                ))}
              </div>

              {vistaMaestro === "vistas" && (
                <>
                  <p className="hint">ISO 10013 no prescribe una jerarquía: la misma información documentada se ordena y filtra según quién la consulte. Estas son las agrupaciones disponibles para la biblioteca.</p>
                  <div className="lvls" style={{ marginBottom: 18 }}>
                    {VISTAS_A1.map((v) => (
                      <button key={v.k} className="lvl" style={{ textAlign: "left", cursor: "pointer", borderColor: cfg.vista === v.k ? "var(--navy)" : "var(--line)", background: cfg.vista === v.k ? "#F5F9FF" : "#FAFBFC" }} onClick={() => up("vista", v.k)}>
                        <span className="no" style={{ background: cfg.vista === v.k ? "var(--mint-dk)" : "#C7D3E2" }}>{cfg.vista === v.k ? "✓" : ""}</span>
                        <div><b>{v.t}</b><small>{v.d}</small>
                          {cfg.vista === v.k && v.k === "tipo" && (
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {NIVELES.map((l) => <span className="tag" key={l.n} style={{ background: l.c + "1A", color: l.c }}>{l.t} · {maestro.filter((d) => d.nivel === l.n).length}</span>)}
                            </div>
                          )}
                          {cfg.vista === v.k && v.k === "funcional" && (
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {cfg.procesos.filter((p) => maestro.some((d) => d.proc === p.s)).map((p) => (
                                <span className="tag" key={p.s} style={{ background: "#EAF1F9", color: "#27507F" }}>{p.n} · {maestro.filter((d) => d.proc === p.s).length}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {vistaMaestro === "gap" && (
                <div style={{ marginBottom: 18 }}>
                  <p className="hint">Antes de crear nada, compara lo que ya existe con lo que el sistema exige. Marca el estado de cada elemento y Solinal arma el plan de trabajo.</p>
                  <div className="steps">
                    {PASOS_IMPL.map((p) => <div className="step" key={p}>{p}</div>)}
                  </div>
                </div>
              )}

              <div className="filters">
                <input className="in" placeholder="Buscar por documento o código" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <select className="sel" value={fProc} onChange={(e) => setFProc(e.target.value)}>
                  <option value="todos">Todos los procesos</option>
                  {cfg.procesos.map((p) => <option key={p.s} value={p.s}>{p.n}</option>)}
                </select>
                <select className="sel" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                  <option value="todos">Todos los tipos</option>
                  {cfg.tipos.map((t) => <option key={t.s} value={t.s}>{t.n}</option>)}
                </select>
                <button className="btn sm" onClick={() => flash("Listado maestro exportado en Excel y PDF/A.")}>Exportar</button>
                <button className="btn sm pri" onClick={() => flash(`${maestroFiltrado.length} documentos creados en estado Borrador y asignados a su dueño de proceso.`)}>Crear documentos en borrador</button>
              </div>
              <div className="tblWrap">
                <table className="data" style={{ minWidth: 980 }}>
                  <thead>
                    <tr><th>Código</th><th>Documento</th><th>Tipo</th><th>Nivel</th><th>Proceso</th><th>Origen</th><th>Se debe</th><th>Versión</th><th>{vistaMaestro === "gap" ? "Análisis" : "Estado"}</th><th>Retención</th></tr>
                  </thead>
                  <tbody>
                    {maestroFiltrado.length === 0 && <tr><td colSpan={10} style={{ color: "var(--muted)" }}>No hay documentos que coincidan con el filtro.</td></tr>}
                    {maestroFiltrado.map((d) => {
                      const lv = NIVELES.find((l) => l.n === d.nivel) || NIVELES[2];
                      return (
                        <tr key={d.codigo + d.nombre}>
                          <td><span className="code">{d.codigo}</span></td>
                          <td style={{ fontWeight: 500, minWidth: 240 }}>{d.nombre}</td>
                          <td style={{ fontSize: 12 }}>{nombreTipo(cfg, d.tipo)}</td>
                          <td><span className="tag" style={{ background: lv.c + "1A", color: lv.c }}>{d.nivel} · {lv.t}</span></td>
                          <td style={{ fontSize: 12 }}>{nombreProc(cfg, d.proc)}</td>
                          <td style={{ fontSize: 11, color: "var(--muted)", minWidth: 160 }}>{d.cl.join(" · ")}</td>
                          <td><span className="tag" style={{ background: d.mc === "M" ? "#EAF1F9" : "#E9FBF5", color: d.mc === "M" ? "#27507F" : "#12A97F" }}>{d.mc === "M" ? "Mantener" : "Conservar"}</span></td>
                          <td>{fmtVersion(cfg.ver.esquema, 1)}</td>
                          <td style={{ minWidth: 150 }}>
                            {vistaMaestro === "gap" ? (
                              <select value={gapDe(d.nombre)} onChange={(e) => setGap(d.nombre, e.target.value)}
                                style={{ background: (GAP.find((g) => g.k === gapDe(d.nombre)) || GAP[2]).b, color: (GAP.find((g) => g.k === gapDe(d.nombre)) || GAP[2]).c, fontWeight: 600 }}>
                                {GAP.map((g) => <option key={g.k} value={g.k}>{g.t}</option>)}
                              </select>
                            ) : <span className="tag" style={{ background: "#F1F4F8", color: "#6B7C93" }}>Borrador</span>}
                          </td>
                          <td style={{ fontSize: 12 }}>{d.retencion}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                Mostrando {maestroFiltrado.length} de {maestro.length} elementos · {nMantener} para mantener y {nConservar} para conservar.
              </p>
            </div>
          </div>
        )}

        {/* ============ 09 CUMPLIMIENTO ============ */}
        {tab === "comp" && (
          <div className="cdgrid one">
            <div className="card">
              <span className="eyebrow">ISO 9001:2015 · numeral 7.5</span>
              <h3>Cobertura de los requisitos de información documentada</h3>
              <p className="hint">Cada requisito se enlaza con la parte del módulo que lo satisface. Lo pendiente aparece en ámbar.</p>
              <div className="bar"><i style={{ width: pct + "%" }} /></div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{checks.filter((c) => c.ok).length} de {checks.length} requisitos cubiertos · {pct}%</div>
              <div className="cdgrid" style={{ marginTop: 4 }}>
                <div>{checks.slice(0, 7).map((c) => (
                  <div className="comp" key={c.cl + c.t}>
                    <span className="mark" style={{ background: c.ok ? "#12A97F" : "#E4A11B" }}>{c.ok ? "✓" : "!"}</span>
                    <div><span className="cl">{c.cl}</span><b>{c.t}</b><small>{c.d}</small></div>
                  </div>
                ))}</div>
                <div>{checks.slice(7).map((c) => (
                  <div className="comp" key={c.cl + c.t}>
                    <span className="mark" style={{ background: c.ok ? "#12A97F" : "#E4A11B" }}>{c.ok ? "✓" : "!"}</span>
                    <div><span className="cl">{c.cl}</span><b>{c.t}</b><small>{c.d}</small></div>
                  </div>
                ))}</div>
              </div>
            </div>

            <div className="card">
              <span className="eyebrow b">ISO 10013:2021 · orientación aplicada</span>
              <h3>Cómo el módulo sigue la guía de información documentada</h3>
              <p className="hint">Estos puntos no son requisitos auditables: son las recomendaciones de la guía que Solinal implementa. Aun así, son lo que diferencia un repositorio de archivos de un sistema documental.</p>
              <div className="bar"><i style={{ width: pctG + "%" }} /></div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{guias.filter((c) => c.ok).length} de {guias.length} recomendaciones aplicadas · {pctG}%</div>
              <div className="cdgrid" style={{ marginTop: 4 }}>
                <div>{guias.slice(0, 7).map((c) => (
                  <div className="comp" key={c.cl + c.t}>
                    <span className="mark" style={{ background: c.ok ? "#12A97F" : "#E4A11B" }}>{c.ok ? "✓" : "!"}</span>
                    <div><span className="cl">{c.cl}</span><b>{c.t}</b><small>{c.d}</small></div>
                  </div>
                ))}</div>
                <div>{guias.slice(7).map((c) => (
                  <div className="comp" key={c.cl + c.t}>
                    <span className="mark" style={{ background: c.ok ? "#12A97F" : "#E4A11B" }}>{c.ok ? "✓" : "!"}</span>
                    <div><span className="cl">{c.cl}</span><b>{c.t}</b><small>{c.d}</small></div>
                  </div>
                ))}</div>
              </div>
            </div>

            <div className="card">
              <h3>Resumen de la configuración</h3>
              <div className="tblWrap">
                <table className="data" style={{ minWidth: 520 }}>
                  <tbody>
                    {[
                      ["Normas aplicables", NORMAS.filter((n) => cfg.normas.includes(n.id)).map((n) => n.n).join(" · ") || "Sin seleccionar"],
                      ["Perfil documental", `${perfil.pc}% · estructura ${perfil.nivel}`],
                      ["Vista de la biblioteca", (VISTAS_A1.find((v) => v.k === cfg.vista) || VISTAS_A1[0]).t],
                      ["Información documentada", `${maestro.length} elementos · ${nMantener} mantener / ${nConservar} conservar`],
                      ["Codificación", buildCode(cfg)],
                      ["Tipos y procesos", `${cfg.tipos.length} tipos en 5 niveles · ${cfg.procesos.length} procesos`],
                      ["Encabezado", HEADER_TPLS.find((t) => t.id === cfg.header.tpl).n],
                      ["Pie de página", FOOTER_TPLS.find((t) => t.id === cfg.footer.tpl).n],
                      ["Versionado", `${fmtVersion(cfg.ver.esquema, 1)} → ${fmtVersion(cfg.ver.esquema, 2)} → ${fmtVersion(cfg.ver.esquema, 3)}`],
                      ["Revisión", cfg.ver.periodicidad === "evento" ? "Por evento" : `Cada ${cfg.ver.periodicidad} meses`],
                      ["Conservación", `${cfg.ctrl.retencionDefault} · ${cfg.ctrl.disposicion}`],
                    ].map(([k, v]) => <tr key={k}><td style={{ fontWeight: 600, width: 210 }}>{k}</td><td>{v}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button className="btn sm" onClick={() => flash("Informe de cobertura 7.5 generado.")}>Descargar informe de cobertura</button>
                <button className="btn sm" onClick={() => setTab("maestro")}>Ver listado maestro</button>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <h3 style={{ padding: "6px 6px 0" }}>Documento resultante</h3>
              <Hoja cfg={cfg} doc={docEjemplo} secciones={secciones} />
            </div>
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
