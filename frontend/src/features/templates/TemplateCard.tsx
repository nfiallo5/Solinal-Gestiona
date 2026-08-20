import { FileText, BookOpen, ListChecks, ClipboardCheck, ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DocumentTemplate, TemplateLevel } from "@/data/seed";

interface TemplateCardProps {
  template: DocumentTemplate;
  onSelect: (template: DocumentTemplate) => void;
}

const nivelIcon: Record<TemplateLevel, typeof FileText> = {
  "Política": ScrollText,
  "Manual": BookOpen,
  "Procedimiento": FileText,
  "Instructivo": ListChecks,
  "Registro": ClipboardCheck,
};

/** Ported from js/templates.js renderTemplates() (.template-card). */
export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(template)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(template);
      }}
      className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-secondary" />
          <strong className="text-sm font-bold">{template.name}</strong>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{template.desc}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">
            {template.norma}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {template.type}
          </Badge>
          <Badge variant="secondary" className="gap-1 font-normal">
            {(() => {
              const Icon = nivelIcon[template.nivel];
              return <Icon className="size-3" />;
            })()}
            {template.nivel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
