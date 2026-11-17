"use client";

import { ClassicIcon } from "./ClassicIcons";
import { CLASSIC_INDICATORS, scoreToLevel } from "@/lib/profileClassic";
import { ratingsCaption } from "./TechProfileIndicators";
import type { TechProfileScore } from "@/types";

interface ClassicIndicatorsProps {
  scores: TechProfileScore;
  ratingsCount?: number;
  fanCount: number | null;
  iAmFan: boolean;
  /** Só quem vê o perfil de OUTRA pessoa pode virar fã. */
  canToggleFan: boolean;
  fanBusy?: boolean;
  fanError?: string | null;
  onToggleFan?: () => void;
  /** Um indicador por linha (colunas estreitas, ex.: lateral da Home). */
  stacked?: boolean;
}

/**
 * Faixa de indicadores no estilo do Orkut: "sou fã" (estrela) e três escalas de até 3 símbolos
 * (preenchidos/vazios). As escalas vêm das médias que o banco já calcula (profile_social_scores).
 */
export function ClassicIndicators({ scores, ratingsCount, fanCount, iAmFan, canToggleFan, fanBusy, fanError, onToggleFan, stacked = false }: ClassicIndicatorsProps) {
  return (
    <div className="rounded-edkut border border-edkut-border bg-edkut-blueSoft px-3 py-2">
      <div className={stacked ? "flex flex-col items-start gap-1.5" : "flex flex-wrap items-center gap-x-5 gap-y-1.5"}>
        <div className="flex items-center gap-1.5" data-testid="fan-indicator">
          <span className="font-heading text-xs font-bold text-edkut-muted">sou fã</span>
          {canToggleFan ? (
            <button
              type="button"
              onClick={onToggleFan}
              disabled={fanBusy}
              aria-pressed={iAmFan}
              aria-label={iAmFan ? "Deixar de ser fã" : "Tornar-se fã"}
              title={iAmFan ? "você é fã — clique para deixar de ser" : "clique para ser fã"}
              className="rounded p-0.5 hover:bg-white disabled:opacity-60"
            >
              <ClassicIcon kind="star" filled={iAmFan} size={20} />
            </button>
          ) : (
            <span title="fãs" className="p-0.5">
              <ClassicIcon kind="star" filled={(fanCount ?? 0) > 0} size={20} />
            </span>
          )}
          <span className="text-xs font-bold text-edkut-blue">{fanCount ?? "–"}</span>
        </div>

        {CLASSIC_INDICATORS.map((ind) => {
          const level = scoreToLevel(scores[ind.key]);
          return (
            <div key={ind.key} className="flex items-center gap-1.5" title={`${ind.label}: ${scores[ind.key]}% — ${ind.hint}`}>
              <span className="font-heading text-xs font-bold text-edkut-muted">{ind.label}:</span>
              <span role="img" aria-label={`${ind.label}: ${level} de 3`} className="flex items-center gap-0.5" data-level={level} data-indicator={ind.key}>
                {[0, 1, 2].map((i) => (
                  <ClassicIcon key={i} kind={ind.icon} filled={i < level} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      {fanError && (
        <p role="alert" className="mt-1.5 text-[11px] text-edkut-pinkDark">
          {fanError}
        </p>
      )}
      {ratingsCount !== undefined && (
        <p className="mt-1.5 text-[11px] text-edkut-muted" aria-live="polite">
          {ratingsCaption(ratingsCount)}
        </p>
      )}
    </div>
  );
}
