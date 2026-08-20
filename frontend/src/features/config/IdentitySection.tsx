import { useRef, useState } from "react";
import { ImagePlus, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgConfig } from "@/data/seed";

/**
 * Identidad corporativa y Marca — port of the legacy branding card in
 * pg-config (config-org-name / config-brand-color / applyConfigBrandColor()).
 *
 * The logo uploader has no backing field in OrgConfig (seed.ts is the
 * shared contract and isn't extended here) — it's a presentational,
 * session-only preview so the panel still matches the "org name, brand
 * color, logo" spec; nothing is persisted or wired into global state.
 */
export function IdentitySection({
  draft,
  onChange,
}: {
  draft: Pick<OrgConfig, "orgName" | "brandColor">;
  onChange: (changes: Partial<OrgConfig>) => void;
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoPick(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4 text-primary" />
          Identidad corporativa y marca
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="config-org-name">Nombre de la organización</Label>
          <Input
            id="config-org-name"
            value={draft.orgName}
            onChange={(e) => onChange({ orgName: e.target.value })}
            className="bg-muted focus-visible:ring-2"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="config-brand-color">Color corporativo principal</Label>
          <div className="flex items-center gap-3">
            <input
              id="config-brand-color"
              type="color"
              value={draft.brandColor}
              onChange={(e) => onChange({ brandColor: e.target.value })}
              className="size-9 cursor-pointer rounded-md border border-input bg-muted p-1 transition-colors hover:border-ring"
            />
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold text-foreground">
              {draft.brandColor.toUpperCase()}
            </span>
            <span
              className="ml-auto h-8 flex-1 rounded-md border border-border"
              style={{ backgroundColor: draft.brandColor }}
              aria-hidden
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Logo de la organización</Label>
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-input bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Subir logo
              </button>
              <span className="text-[11px] text-muted-foreground">
                Vista previa local — no se envía a ningún servidor en este prototipo.
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoPick(e.target.files?.[0])}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
