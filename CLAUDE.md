# Propuesta de implementación — Mejora del módulo de Plantillas ISO

**Proyecto:** Solinal Gestiona
**Alcance:** `frontend/src/data/seed.ts`, `frontend/src/context/AppStateContext.tsx`, `frontend/src/features/templates/*`, `frontend/src/features/documents/*`, `frontend/src/routes/Editor.tsx`
**Objetivo:** llevar el modelo `DocumentTemplate` de una lista plana de secciones a una estructura alineada con la pirámide documental ISO y la cláusula 7.5 (Información Documentada) de ISO 9001:2015, sin romper los datos semilla existentes.

> Convención del proyecto: todo cambio de acciones/reducer va dentro del bloque `FEATURE-AGENT EXTENSIONS` en `AppStateContext.tsx`, en su propia sub-sección comentada. No se debe tocar código por encima de esa línea.

---

## Índice

1. [Enriquecer el modelo `DocumentTemplate`](#1-enriquecer-el-modelo-documenttemplate)
2. [Modelar la jerarquía padre-hijo](#2-modelar-la-jerarquía-padre-hijo)
3. [Definir roles de aprobación por plantilla](#3-definir-roles-de-aprobación-por-plantilla)
4. [Separar "Documento" de "Registro"](#4-separar-documento-de-registro)
5. [Mejorar la UI de Plantillas](#5-mejorar-la-ui-de-plantillas)
6. [Orden de implementación sugerido](#6-orden-de-implementación-sugerido)

---

## 1. Enriquecer el modelo `DocumentTemplate`

**Por qué:** hoy `mandatory: string[]` es solo una lista de nombres de sección sin propósito ni trazabilidad normativa. La cláusula 7.5 exige que cada documento tenga identificación, descripción, formato y periodicidad de revisión definidos — nada de esto existe como campo hoy.

### Archivos a modificar

- `frontend/src/data/seed.ts`
- `frontend/src/features/templates/NewTemplateDialog.tsx`
- `frontend/src/features/templates/aiSimulator.ts`

### Paso 1.1 — Ampliar la interfaz en `seed.ts`

Ubica la interfaz `DocumentTemplate` (actualmente cerca de la línea donde se define `AuditLogEntry`, justo después de `SolinalDocument`). Reemplázala por:

```ts
/** Nivel jerárquico dentro de la pirámide documental del SGC. */
export type TemplateLevel =
  | "Política"
  | "Manual"
  | "Procedimiento"
  | "Instructivo"
  | "Registro";

export interface TemplateSection {
  titulo: string;
  /** Qué debe contener/lograr esta sección — no solo su nombre. */
  proposito: string;
  obligatoria: boolean;
}

export interface DocumentTemplate {
  key: string;
  name: string;
  norma: string;
  type: DocumentType;
  desc: string;
  preview: string;
  /** Rich HTML, seeded into a new document's `content` on creation. */
  content: string;

  /** @deprecated usar `secciones`. Se mantiene por compatibilidad con seed data y componentes existentes. */
  mandatory: string[];

  // --- NUEVOS CAMPOS (recomendación #1) --------------------------------
  /** Nivel en la pirámide documental. Distinto de `type`, que es la clasificación operativa. */
  nivel: TemplateLevel;
  /** Cláusula específica de la norma que este documento cubre, ej. "7.5.3", "8.5.1". */
  clausulaIso: string;
  /** Estructura real de secciones, con propósito de cada una. */
  secciones: TemplateSection[];
  /** Cada cuánto debe revisarse el documento creado desde esta plantilla. */
  periodicidadRevision: "Anual" | "Bienal" | "Semestral" | "No aplica";
  /** Tiempo mínimo de conservación del documento/registro, en años. */
  tiempoRetencionAnios: number;
}
```

**Nota de compatibilidad:** se deja `mandatory` marcado como `@deprecated` en vez de eliminarlo, porque `seedTemplates`, `TemplateCard.tsx` y `TemplateDetailDialog.tsx` ya lo consumen. Esto evita romper el build mientras se migra.

### Paso 1.2 — Migrar `seedTemplates` en `seed.ts`

Cada objeto de `seedTemplates` debe ganar los 4 campos nuevos. Ejemplo con la plantilla `procedimiento`:

```ts
{
  key: "procedimiento",
  name: "Procedimiento ISO 9001",
  norma: "ISO 9001:2015",
  type: "Procedimiento",
  desc: "Estructura con alcance, responsabilidades, control de cambios y registros.",
  preview: "Incluye alcance, responsables, registros y control de cambios.",
  content: "<ol><li>Alcance</li><li>Responsabilidades</li><li>Recursos y controles</li><li>Registro de calidad</li><li>Control de cambios</li></ol>",
  mandatory: ["Alcance", "Responsabilidades"], // se conserva

  // nuevos:
  nivel: "Procedimiento",
  clausulaIso: "7.5.1",
  periodicidadRevision: "Anual",
  tiempoRetencionAnios: 3,
  secciones: [
    { titulo: "Alcance", proposito: "Delimitar a qué procesos, áreas o productos aplica el documento.", obligatoria: true },
    { titulo: "Responsabilidades", proposito: "Definir quién ejecuta, revisa y aprueba cada actividad descrita.", obligatoria: true },
    { titulo: "Recursos y controles", proposito: "Listar recursos necesarios y puntos de control del proceso.", obligatoria: false },
    { titulo: "Registro de calidad", proposito: "Indicar qué evidencia se genera y dónde se almacena.", obligatoria: true },
    { titulo: "Control de cambios", proposito: "Historial de versiones y motivo de cada cambio.", obligatoria: true },
  ],
},
```

Repetir el mismo patrón para las plantillas `politica`, `checklist` e `instructivo`. Guía rápida de `clausulaIso` sugerida:

| Plantilla existente | `nivel` sugerido | `clausulaIso` sugerida |
|---|---|---|
| Procedimiento ISO 9001 | `Procedimiento` | `7.5.1` |
| Política de Calidad | `Política` | `5.2` |
| Checklist HACCP | `Registro` | `8.5.1` (control de la producción) |
| Instructivo de Limpieza | `Instructivo` | `8.5.1` |

### Paso 1.3 — Actualizar `NewTemplateDialog.tsx`

En el formulario (`emptyForm` y el `<div className="space-y-4">`), agregar tres inputs nuevos junto a los existentes de `norma` y `type`:

1. Un `<Select>` para `nivel` (mismas opciones que `TemplateLevel`).
2. Un `<Input>` para `clausulaIso` (texto libre, placeholder `"Ej. 7.5.3"`).
3. Un `<Select>` para `periodicidadRevision`.

En `handleSave()`, donde hoy se arma `mandatoryArray` a partir del input de texto separado por comas, generar también `secciones` derivado del mismo array de forma transitoria:

```ts
const secciones: TemplateSection[] = mandatoryArray.map((titulo) => ({
  titulo,
  proposito: "", // el usuario puede completarlo luego editando la plantilla
  obligatoria: true,
}));
```

Esto permite lanzar el cambio sin rediseñar el formulario completo de una vez (el rediseño real del input se cubre en la [recomendación #5](#5-mejorar-la-ui-de-plantillas)).

### Paso 1.4 — Actualizar `aiSimulator.ts`

En `AITemplateProposal`, agregar los mismos 4 campos opcionales con valores por defecto razonables (ej. `nivel` inferido del `type` detectado, `periodicidadRevision: "Anual"` por defecto, `clausulaIso: ""` para que el usuario la complete).

### Criterio de aceptación

- [ ] El proyecto compila sin errores de tipo tras agregar los campos.
- [ ] Las 4 plantillas semilla tienen `nivel`, `clausulaIso`, `secciones` y `periodicidadRevision` poblados.
- [ ] `NewTemplateDialog` permite capturar `nivel`, `clausulaIso` y `periodicidadRevision` al crear una plantilla nueva.

---

## 2. Modelar la jerarquía padre-hijo

**Por qué:** la pirámide documental (Política → Manual → Procedimiento → Instructivo → Registro) implica dependencia entre niveles. Hoy no hay forma de expresar "este Instructivo pertenece a este Procedimiento", lo que impide detectar instructivos huérfanos — algo que `useRequirementMapping` en `useCompliance.ts` ya hace a nivel de norma+tipo, pero no a nivel de plantilla individual.

### Archivos a modificar

- `frontend/src/data/seed.ts`
- `frontend/src/features/templates/TemplateDetailDialog.tsx`
- `frontend/src/features/compliance/useCompliance.ts`

### Paso 2.1 — Agregar el campo a `DocumentTemplate` en `seed.ts`

Dentro de la misma interfaz ampliada en el paso 1.1, agregar:

```ts
export interface DocumentTemplate {
  // ...campos existentes y los del punto 1...

  // --- NUEVO CAMPO (recomendación #2) -----------------------------------
  /** `key` de la plantilla superior en la pirámide documental. `null`/omitido si es de nivel raíz (Política o Manual). */
  documentoPadreKey?: string;
}
```

### Paso 2.2 — Enlazar las plantillas semilla en `seed.ts`

Con las 4 plantillas actuales, el único enlace natural es:

```ts
{
  key: "instructivo",
  // ...
  nivel: "Instructivo",
  documentoPadreKey: "procedimiento", // el Instructivo de Limpieza depende del Procedimiento ISO 9001
  // ...
},
```

`procedimiento` y `politica` quedan sin `documentoPadreKey` (son de nivel raíz). `checklist`, al marcarse como `nivel: "Registro"`, puede enlazarse al procedimiento o instructivo que evidencia — evaluar caso a caso con el equipo de calidad al migrar datos reales.

### Paso 2.3 — Mostrar la cadena jerárquica en `TemplateDetailDialog.tsx`

Dentro del componente, antes del bloque de "Secciones obligatorias", agregar una función auxiliar y un bloque condicional:

```tsx
// dentro del componente, necesita acceso a state.templates vía useAppState()
const { state } = useAppState();
const padre = template?.documentoPadreKey
  ? state.templates.find((t) => t.key === template.documentoPadreKey)
  : undefined;
```

```tsx
{padre && (
  <div>
    <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
      Depende de
    </div>
    <Badge variant="outline" className="font-normal">
      {padre.name}
    </Badge>
  </div>
)}
```

### Paso 2.4 — Extender la detección de huérfanos en `useCompliance.ts`

En `useRequirementMapping()`, después de construir `pairs`, agregar una segunda pasada que detecte plantillas hijas cuyo padre no tiene ningún documento aprobado asociado. Esto es una extensión aditiva — no modifica el `RequirementRow` existente, sino que puede exponerse como un nuevo hook `useOrphanTemplates()` en el mismo archivo:

```ts
export function useOrphanTemplates() {
  const { state } = useAppState();
  return useMemo(() => {
    return state.templates.filter((t) => {
      if (!t.documentoPadreKey) return false;
      const padre = state.templates.find((p) => p.key === t.documentoPadreKey);
      if (!padre) return true; // padre eliminado o mal referenciado
      const padreTieneDocAprobado = state.documents.some(
        (d) => d.norma === padre.norma && d.type === padre.type && d.estado === "Aprobado" && !d.vencido,
      );
      return !padreTieneDocAprobado;
    });
  }, [state.templates, state.documents]);
}
```

Este hook queda listo para consumirse en `Plantillas.tsx` o en el `GeneralAlerts` del dashboard como una alerta adicional — no es obligatorio conectarlo a la UI en esta primera iteración, pero se deja preparado.

### Criterio de aceptación

- [ ] Al menos una plantilla semilla (`instructivo`) referencia a otra vía `documentoPadreKey`.
- [ ] `TemplateDetailDialog` muestra el badge "Depende de" cuando corresponde.
- [ ] `useOrphanTemplates()` no rompe el build y retorna `[]` cuando no hay huérfanos.

---

## 3. Definir roles de aprobación por plantilla

**Por qué:** 7.5.2 exige que la creación/revisión/aprobación de un documento pase por responsables definidos. Hoy `Editor.tsx` solo maneja `signatures: string[]` como una lista de nombres sin ligarlos a un rol esperado por la plantilla de origen — la plantilla no dice quién *debería* firmar.

### Archivos a modificar

- `frontend/src/data/seed.ts`
- `frontend/src/context/AppStateContext.tsx`
- `frontend/src/routes/Editor.tsx` (o el diálogo de creación de documento que usa la plantilla, típicamente `CreateDocumentDialog`)

### Paso 3.1 — Agregar el campo a `DocumentTemplate` en `seed.ts`

```ts
export interface DocumentTemplate {
  // ...campos existentes...

  // --- NUEVO CAMPO (recomendación #3) -----------------------------------
  /** Roles que deben participar en el ciclo de vida de un documento creado desde esta plantilla. */
  rolesRequeridos: {
    elaborador: RoleName;
    revisor: RoleName;
    aprobador: RoleName;
    /** Si true, replica la regla de doble firma que ya existe para `critico` en SolinalDocument. */
    dobleAprobacion: boolean;
  };
}
```

Poblar en las 4 plantillas semilla, por ejemplo para `politica`:

```ts
rolesRequeridos: {
  elaborador: "Elaborador",
  revisor: "Revisor",
  aprobador: "Aprobador",
  dobleAprobacion: true, // las políticas suelen ser críticas
},
```

### Paso 3.2 — Propagar `rolesRequeridos` a `SolinalDocument` al crear un documento

En `SolinalDocument` (misma zona de `seed.ts`), agregar un campo opcional para no romper los documentos semilla existentes:

```ts
export interface SolinalDocument {
  // ...campos existentes...
  /** Copiado desde la plantilla de origen al crear el documento; guía a Editor.tsx sobre quién debe firmar. */
  rolesRequeridos?: {
    elaborador: RoleName;
    revisor: RoleName;
    aprobador: RoleName;
    dobleAprobacion: boolean;
  };
}
```

### Paso 3.3 — Ubicar y modificar el flujo de creación de documento

Buscar el componente que arma un `SolinalDocument` nuevo a partir de una `DocumentTemplate` seleccionada (dispara la acción `ADD_DOCUMENT`, probablemente en un diálogo tipo `CreateDocumentDialog` referenciado desde `Documentos.tsx` o `TemplateDetailDialog.tsx`). Ahí, al construir el nuevo documento:

```ts
const newDoc: SolinalDocument = {
  // ...campos existentes...
  critico: template.rolesRequeridos.dobleAprobacion, // reemplaza el booleano suelto actual
  rolesRequeridos: template.rolesRequeridos,
};
```

Esto además resuelve una inconsistencia ya detectada: hoy `critico` es un booleano que no se deriva de nada — con este cambio se deriva directamente de la exigencia de la plantilla.

### Paso 3.4 — Validar el rol de quien firma en `Editor.tsx`

En la función que maneja la firma (cerca de `handleSign` / donde se ve `updateDoc({ signatures: nextSignatures, ... })`), agregar una validación antes de aceptar la firma:

```ts
const rolesEsperados = doc.rolesRequeridos;
if (rolesEsperados && state.session.activeRole !== rolesEsperados.aprobador && state.session.activeRole !== rolesEsperados.revisor) {
  toast.error(`Este documento requiere firma de ${rolesEsperados.revisor} o ${rolesEsperados.aprobador}.`);
  return;
}
```

**Nota:** esta validación debe agregarse dentro del bloque de lógica existente sin eliminar el manejo actual de `critico` (primera firma / co-firma) — solo se antepone como guardia adicional.

### Criterio de aceptación

- [ ] Las 4 plantillas semilla tienen `rolesRequeridos` poblado.
- [ ] Un documento creado desde una plantilla hereda `rolesRequeridos` y su `critico` se deriva de `dobleAprobacion`.
- [ ] `Editor.tsx` rechaza con un `toast.error` la firma de un usuario cuyo rol activo no coincide con el rol esperado.

---

## 4. Separar "Documento" de "Registro"

**Por qué:** un Registro (ej. un Checklist ya firmado) es evidencia congelada — no debería poder editarse después de aprobado. Hoy `Checklist` se trata igual que `Procedimiento` o `Política` en `Editor.tsx`: el `content` sigue siendo editable sin importar el estado.

### Archivos a modificar

- `frontend/src/data/seed.ts`
- `frontend/src/routes/Editor.tsx`
- `frontend/src/features/editor/ContentEditor.tsx` (o el componente que envuelve el `contentEditable`)

### Paso 4.1 — Derivar "es registro" desde `nivel`, no crear un campo nuevo redundante

Como ya se agregó `nivel: TemplateLevel` en el paso 1.1, y `TemplateLevel` incluye `"Registro"`, **no es necesario un campo booleano adicional** en la plantilla. En su lugar, agregar una función utilitaria en `seed.ts` o en un archivo de utilidades existente (ej. `docStyles.ts`, ya usado por `MetadataForm.tsx`):

```ts
// en frontend/src/features/documents/docStyles.ts
export function esRegistroPorNivel(nivel: TemplateLevel): boolean {
  return nivel === "Registro";
}
```

### Paso 4.2 — Propagar el nivel al documento creado

En `SolinalDocument` (`seed.ts`), agregar:

```ts
export interface SolinalDocument {
  // ...campos existentes y los de la sección 3...

  // --- NUEVO CAMPO (recomendación #4) -----------------------------------
  /** Copiado desde `template.nivel` al crear el documento. Determina si el contenido se bloquea tras la primera firma. */
  nivel?: TemplateLevel;
}
```

Y en el flujo de creación de documento (mismo lugar del paso 3.3):

```ts
const newDoc: SolinalDocument = {
  // ...
  nivel: template.nivel,
};
```

### Paso 4.3 — Bloquear edición de contenido en `Editor.tsx` / `ContentEditor.tsx`

Ubicar dónde se renderiza el editor de contenido (`contentEditable` o el componente `ContentEditor`). Calcular una bandera derivada:

```ts
const contenidoBloqueado =
  doc.nivel === "Registro" && doc.signatures.length > 0;
```

Pasar esta bandera como prop al componente de edición, por ejemplo:

```tsx
<ContentEditor
  content={doc.content}
  onChange={handleContentChange}
  readOnly={contenidoBloqueado}
/>
```

Dentro de `ContentEditor.tsx`, si ya expone una prop de solo lectura, reutilizarla; si no, agregar `readOnly?: boolean` a sus props y usarla para deshabilitar la barra de herramientas y poner `contentEditable={!readOnly}` en el elemento editable.

Adicionalmente, en la UI mostrar un aviso cuando el registro está bloqueado (cerca del encabezado del editor, junto a `MetadataForm`):

```tsx
{contenidoBloqueado && (
  <div className="rounded-md border-l-4 border-secondary bg-muted p-3 text-xs text-muted-foreground">
    Este documento es un <strong>Registro</strong> y ya cuenta con firma(s). Su contenido queda protegido como evidencia y no puede modificarse.
  </div>
)}
```

### Paso 4.4 — Reforzar en el reducer (defensa en profundidad)

En `AppStateContext.tsx`, dentro del `case "UPDATE_DOCUMENT"` (código existente, **no** dentro del bloque de extensiones porque es una acción base — coordinar con el resto del equipo antes de tocar código compartido), considerar rechazar cambios a `content` si el documento es un registro firmado. Si se prefiere no tocar código compartido, esta validación puede quedar únicamente en la capa de UI (paso 4.3), documentando la limitación.

### Criterio de aceptación

- [ ] `SolinalDocument` propaga `nivel` desde la plantilla de origen.
- [ ] Un documento con `nivel: "Registro"` y al menos una firma no permite editar su `content` desde la UI.
- [ ] Se muestra un aviso visual explicando por qué el contenido está bloqueado.

---

## 5. Mejorar la UI de Plantillas

**Por qué:** con el modelo enriquecido de los puntos 1-4, la UI actual (`TemplateCard`, `TemplateDetailDialog`, `NewTemplateDialog`) se queda corta — solo muestra `norma` y `type` como badges y una lista plana de texto.

### Archivos a modificar

- `frontend/src/features/templates/TemplateCard.tsx`
- `frontend/src/features/templates/TemplateDetailDialog.tsx`
- `frontend/src/features/templates/NewTemplateDialog.tsx`

### Paso 5.1 — Badge de nivel jerárquico en `TemplateCard.tsx`

Junto a los badges existentes de `norma` y `type`, agregar un tercer badge con ícono distinto por nivel. Se puede usar un mapa simple de íconos de `lucide-react` (ya se importa `FileText` en este archivo):

```tsx
import { FileText, BookOpen, ListChecks, ClipboardCheck, ScrollText } from "lucide-react";

const nivelIcon: Record<TemplateLevel, typeof FileText> = {
  "Política": ScrollText,
  "Manual": BookOpen,
  "Procedimiento": FileText,
  "Instructivo": ListChecks,
  "Registro": ClipboardCheck,
};
```

Y en el JSX, dentro del `<div className="mt-3 flex flex-wrap gap-1.5">` existente:

```tsx
<Badge variant="secondary" className="font-normal gap-1">
  {(() => { const Icon = nivelIcon[template.nivel]; return <Icon className="size-3" />; })()}
  {template.nivel}
</Badge>
```

### Paso 5.2 — Sección de contexto normativo en `TemplateDetailDialog.tsx`

Después del bloque de badges existente (`norma` / `type`) y antes de "Secciones obligatorias", agregar:

```tsx
<div className="grid grid-cols-2 gap-3 text-xs">
  <div>
    <div className="mb-1 font-semibold text-muted-foreground">Cláusula ISO</div>
    <div className="font-medium">{template.clausulaIso || "No especificada"}</div>
  </div>
  <div>
    <div className="mb-1 font-semibold text-muted-foreground">Revisión</div>
    <div className="font-medium">{template.periodicidadRevision}</div>
  </div>
</div>
```

Y reemplazar el bloque actual de "Secciones obligatorias" (que itera `template.mandatory`) por uno que muestre `secciones` con su propósito:

```tsx
<div>
  <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
    Estructura de secciones
  </div>
  <div className="space-y-2">
    {template.secciones.map((s) => (
      <div key={s.titulo} className="rounded-md border border-border p-2">
        <div className="flex items-center gap-1.5">
          <Badge className="font-normal">{s.titulo}</Badge>
          {s.obligatoria && (
            <span className="text-[10px] uppercase text-muted-foreground">Obligatoria</span>
          )}
        </div>
        {s.proposito && (
          <p className="mt-1 text-xs text-muted-foreground">{s.proposito}</p>
        )}
      </div>
    ))}
  </div>
</div>
```

**Nota de compatibilidad:** si alguna plantilla todavía no fue migrada (`secciones` vacío), añadir un fallback que muestre `template.mandatory` como antes:

```tsx
{template.secciones.length > 0 ? (
  /* bloque nuevo de arriba */
) : (
  /* bloque original con template.mandatory */
)}
```

### Paso 5.3 — Constructor de secciones dinámico en `NewTemplateDialog.tsx`

Reemplazar el único `<Input>` de "Estructura / secciones obligatorias (separa por comas)" por una lista editable. Cambiar el estado del formulario:

```ts
const emptyForm = {
  name: "",
  norma: NORMAS[0],
  type: TYPES[0],
  nivel: "Procedimiento" as TemplateLevel,
  clausulaIso: "",
  periodicidadRevision: "Anual" as const,
  secciones: [] as TemplateSection[],
  desc: "",
};
```

Agregar un sub-componente simple dentro del mismo archivo (o extraerlo a `SeccionesEditor.tsx` si crece):

```tsx
function SeccionesEditor({ secciones, onChange }: { secciones: TemplateSection[]; onChange: (s: TemplateSection[]) => void }) {
  function addSeccion() {
    onChange([...secciones, { titulo: "", proposito: "", obligatoria: true }]);
  }
  function updateSeccion(i: number, changes: Partial<TemplateSection>) {
    onChange(secciones.map((s, idx) => (idx === i ? { ...s, ...changes } : s)));
  }
  function removeSeccion(i: number) {
    onChange(secciones.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {secciones.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Título de sección"
            value={s.titulo}
            onChange={(e) => updateSeccion(i, { titulo: e.target.value })}
          />
          <Input
            placeholder="Propósito"
            value={s.proposito}
            onChange={(e) => updateSeccion(i, { proposito: e.target.value })}
          />
          <Button variant="outline" size="sm" onClick={() => removeSeccion(i)}>Quitar</Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addSeccion}>+ Agregar sección</Button>
    </div>
  );
}
```

Y en `handleSave()`, construir el `content` (HTML) a partir de `secciones` en vez de `mandatoryArray`:

```ts
content: form.secciones.map((s, i) => `${i + 1}. ${s.titulo}`).join("<br/>"),
mandatory: form.secciones.map((s) => s.titulo), // se mantiene poblado por compatibilidad
secciones: form.secciones,
```

### Criterio de aceptación

- [ ] `TemplateCard` muestra un badge de nivel con ícono distintivo.
- [ ] `TemplateDetailDialog` muestra cláusula ISO, periodicidad de revisión y secciones con su propósito.
- [ ] `NewTemplateDialog` permite agregar/quitar secciones individualmente en vez de un solo campo de texto separado por comas.
- [ ] Ninguna plantilla existente rompe la UI si algún campo nuevo aún no está poblado (fallbacks aplicados).

---

## 6. Orden de implementación sugerido

Para minimizar riesgo de romper el build y poder probar incrementalmente:

1. **Recomendación #1** primero — es la base de tipos que todo lo demás consume.
2. **Recomendación #5** (parcial: solo `TemplateCard` y `TemplateDetailDialog`) — para validar visualmente que los nuevos campos del punto 1 se ven bien, antes de seguir.
3. **Recomendación #2** — jerarquía, es aditiva y de bajo riesgo.
4. **Recomendación #4** — depende de `nivel` (ya definido en el punto 1), pero toca `Editor.tsx`, que es más sensible.
5. **Recomendación #3** — depende de que el punto 4 ya haya validado el patrón de tocar `Editor.tsx` con cuidado.
6. **Recomendación #5** (resto: `NewTemplateDialog` con el editor dinámico de secciones) — al final, porque es la pieza de UI más compleja y depende de que todos los campos de datos ya existan.

En cada paso, correr `npm run build` (o el comando de type-check del proyecto) antes de pasar al siguiente punto, dado que varios campos nuevos son no-opcionales en `DocumentTemplate` y `seedTemplates` debe migrarse completo para no romper el tipado.
