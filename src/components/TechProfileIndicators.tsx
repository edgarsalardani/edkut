import { TechProfileScore } from "@/types";

export const INDICATOR_ROWS: { key: keyof TechProfileScore; label: string; color: string }[] = [
  { key: "nerd", label: "NERD", color: "#D81B85" },
  { key: "parceiro", label: "PARCEIRO", color: "#3FA66B" },
  { key: "tech", label: "TECH", color: "#1D4E89" },
];

/** Texto "quantos amigos contribuíram" (sem expor votos individuais). */
export function ratingsCaption(ratingsCount: number | undefined): string {
  if (!ratingsCount) return "ainda sem avaliações de amigos";
  return `calculado com a avaliação de ${ratingsCount} ${ratingsCount === 1 ? "amigo" : "amigos"}`;
}

/**
 * Indicadores sociais NERD · PARCEIRO · TECH. Os valores vêm da média das avaliações dos amigos
 * (função profile_social_scores no banco) — não são métricas acadêmicas nem de desempenho técnico.
 *
 * - compact (cards laterais): "placar" de três células, como na V1.1;
 * - padrão (página do perfil): três barras com percentual + legenda de quantos amigos avaliaram.
 */
export function TechProfileIndicators({
  scores,
  compact = false,
  ratingsCount,
}: {
  scores: TechProfileScore;
  compact?: boolean;
  /** Quantos amigos contribuíram. Se omitido no modo barras, nenhuma legenda é mostrada. */
  ratingsCount?: number;
}) {
  if (compact) {
    return (
      <div className="flex divide-x divide-edkut-border rounded-edkut border border-edkut-border bg-edkut-blueSoft">
        {INDICATOR_ROWS.map((row) => (
          <div key={row.key} className="flex-1 py-1.5 text-center">
            <p className="font-heading text-[8px] font-bold tracking-wide" style={{ color: row.color }}>
              {row.label}
            </p>
            <p className="font-heading text-xs font-black leading-tight text-edkut-text">{scores[row.key]}%</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-edkut border border-edkut-border bg-edkut-blueSoft px-3 py-2.5">
      <ul className="flex flex-col gap-1.5">
        {INDICATOR_ROWS.map((row) => (
          <li key={row.key} className="grid grid-cols-[70px_1fr_40px] items-center gap-2">
            <span className="font-heading text-[10px] font-bold tracking-wide" style={{ color: row.color }}>
              {row.label}
            </span>
            <div
              role="progressbar"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={scores[row.key]}
              className="h-2.5 overflow-hidden rounded-full border border-edkut-border bg-white"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${scores[row.key]}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="text-right font-heading text-sm font-black text-edkut-text">{scores[row.key]}%</span>
          </li>
        ))}
      </ul>
      {ratingsCount !== undefined && (
        <p className="mt-1.5 text-[11px] text-edkut-muted" aria-live="polite">
          {ratingsCaption(ratingsCount)}
        </p>
      )}
    </div>
  );
}
