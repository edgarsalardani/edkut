import { TechProfileScore } from "@/types";

const ROWS: { key: keyof TechProfileScore; label: string; color: string }[] = [
  { key: "tech", label: "TECH", color: "#1D4E89" },
  { key: "parceiro", label: "PARCEIRO", color: "#3FA66B" },
  { key: "geek", label: "GEEK", color: "#D81B85" },
];

/**
 * Indicadores sociais do perfil (ver seção 9 da spec). São avaliações
 * sociais simuladas, não métricas acadêmicas ou de desempenho técnico real.
 */
export function TechProfileIndicators({
  scores,
  compact = false,
}: {
  scores: TechProfileScore;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span
            className={`font-heading font-bold text-edkut-text ${compact ? "w-16 text-[10px]" : "w-20 text-xs"}`}
          >
            {row.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-edkut-blueSoft">
            <div
              className="h-full rounded-full"
              style={{ width: `${scores[row.key]}%`, backgroundColor: row.color }}
            />
          </div>
          <span className="w-9 text-right text-xs font-semibold text-edkut-muted">
            {scores[row.key]}%
          </span>
        </div>
      ))}
    </div>
  );
}
