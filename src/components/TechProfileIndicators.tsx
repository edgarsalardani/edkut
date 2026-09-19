import { TechProfileScore } from "@/types";

const ROWS: { key: keyof TechProfileScore; label: string; color: string }[] = [
  { key: "tech", label: "TECH", color: "#1D4E89" },
  { key: "parceiro", label: "PARCEIRO", color: "#3FA66B" },
  { key: "geek", label: "GEEK", color: "#D81B85" },
];

/**
 * Indicadores sociais do perfil (ver seção 9 da spec). São avaliações
 * sociais simuladas, não métricas acadêmicas ou de desempenho técnico real.
 *
 * V1.1: apresentação compacta em "tabela de estatísticas" (três células com
 * divisórias finas), no lugar das barras de progresso da versão anterior —
 * mais próxima de um placar clássico de rede social dos anos 2000.
 */
export function TechProfileIndicators({
  scores,
  compact = false,
}: {
  scores: TechProfileScore;
  compact?: boolean;
}) {
  return (
    <div className="flex divide-x divide-edkut-border rounded-edkut border border-edkut-border bg-edkut-blueSoft">
      {ROWS.map((row) => (
        <div key={row.key} className={`flex-1 text-center ${compact ? "py-1.5" : "py-2"}`}>
          <p
            className={`font-heading font-bold tracking-wide ${compact ? "text-[8px]" : "text-[10px]"}`}
            style={{ color: row.color }}
          >
            {row.label}
          </p>
          <p className={`font-heading font-black leading-tight text-edkut-text ${compact ? "text-xs" : "text-base"}`}>
            {scores[row.key]}%
          </p>
        </div>
      ))}
    </div>
  );
}
