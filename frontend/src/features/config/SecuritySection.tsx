import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgConfig } from "@/data/seed";

const passwordPolicyLabels: Record<OrgConfig["passwordPolicy"], string> = {
  weak: "Básica — mínimo 6 caracteres",
  medium: "Media — mínimo 8 caracteres y un número",
  strong: "Fuerte — mínimo 10 caracteres, mayúscula y número",
};

const doubleApprovalLabels: Record<OrgConfig["doubleApproval"], string> = {
  none: "Desactivada — una sola firma de Aprobador basta",
  critical: "Solo documentos críticos (firma doble)",
  all: "Siempre, para todo documento nuevo",
};

/**
 * Seguridad y acceso — port of the legacy "Políticas de Seguridad" card
 * (config-2fa-toggle / config-password-policy / config-double-approval in
 * js/config.js). The 2FA select becomes the "método de autenticación"
 * switch (password-only vs. password + token), matching OrgConfig's
 * boolean twoFactorEnabled field 1:1.
 */
export function SecuritySection({
  draft,
  onChange,
}: {
  draft: Pick<OrgConfig, "twoFactorEnabled" | "passwordPolicy" | "doubleApproval">;
  onChange: (changes: Partial<OrgConfig>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-primary" />
          Seguridad y acceso
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3">
          <div>
            <Label htmlFor="config-2fa-toggle">Doble factor de autenticación (2FA)</Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Al activarse, se solicitará un token PIN adicional al iniciar sesión.
            </p>
          </div>
          <Switch
            id="config-2fa-toggle"
            checked={draft.twoFactorEnabled}
            onCheckedChange={(checked) => onChange({ twoFactorEnabled: checked })}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="config-password-policy">Política de contraseñas ISO</Label>
          <Select
            value={draft.passwordPolicy}
            onValueChange={(v) => onChange({ passwordPolicy: v as OrgConfig["passwordPolicy"] })}
          >
            <SelectTrigger id="config-password-policy" className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(passwordPolicyLabels) as OrgConfig["passwordPolicy"][]).map((k) => (
                <SelectItem key={k} value={k}>
                  {passwordPolicyLabels[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="config-double-approval">Aprobación doble obligatoria</Label>
          <Select
            value={draft.doubleApproval}
            onValueChange={(v) => onChange({ doubleApproval: v as OrgConfig["doubleApproval"] })}
          >
            <SelectTrigger id="config-double-approval" className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(doubleApprovalLabels) as OrgConfig["doubleApproval"][]).map((k) => (
                <SelectItem key={k} value={k}>
                  {doubleApprovalLabels[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
