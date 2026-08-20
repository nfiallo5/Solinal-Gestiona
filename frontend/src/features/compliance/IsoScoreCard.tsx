import { Card, CardContent } from "@/components/ui/card";
import type { IsoScore } from "./useCompliance";
import { statusBg, statusText } from "./statusStyles";

export function IsoScoreCard({ norma, label, sub, score, status }: IsoScore) {
  return (
    <Card
      key={norma}
      className="transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardContent className="p-5">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className={`mt-1 text-3xl font-bold ${statusText[status]}`}>{score}%</div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${statusBg[status]} transition-[width] duration-700 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
