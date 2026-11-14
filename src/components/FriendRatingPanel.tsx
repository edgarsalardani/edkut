"use client";

import { useState } from "react";
import { rateFriend, type MyRating } from "@/lib/ratings";
import { INDICATOR_ROWS } from "./TechProfileIndicators";
import type { TechProfileScore } from "@/types";

interface FriendRatingPanelProps {
  ratedId: string;
  firstName: string;
  /** Minha avaliação atual (null: ainda não avaliei). */
  initialRating: MyRating | null;
  /** Chamado após salvar com sucesso; o pai rebusca os percentuais consolidados (sem recarregar a página). */
  onSaved: () => Promise<void> | void;
}

const DEFAULT_VALUE = 50;

/**
 * Painel "avalie {amigo}": três sliders de 0 a 100 com a MINHA avaliação atual. Só deve ser renderizado em perfil
 * REAL de amigo (amizade aceita) e nunca no próprio perfil — a regra definitiva é do banco (RLS + rate_friend).
 */
export function FriendRatingPanel({ ratedId, firstName, initialRating, onSaved }: FriendRatingPanelProps) {
  const start = (r: MyRating | null): Record<keyof TechProfileScore, number> => ({
    nerd: r?.nerd ?? DEFAULT_VALUE,
    parceiro: r?.parceiro ?? DEFAULT_VALUE,
    tech: r?.tech ?? DEFAULT_VALUE,
  });

  const [saved, setSaved] = useState<MyRating | null>(initialRating);
  const [values, setValues] = useState(() => start(initialRating));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sem voto salvo (ou voto de uma amizade antiga, que não conta): exige salvar mesmo sem mexer nos sliders.
  const needsSave = !saved || !saved.isCurrent;
  const changed = saved ? INDICATOR_ROWS.some((r) => values[r.key] !== saved[r.key]) : true;
  const canSave = !saving && (needsSave || changed);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const result = await rateFriend(ratedId, values);
    if (!result.ok) {
      setSaving(false);
      setError(result.error ?? "Não foi possível salvar a avaliação.");
      return;
    }
    setSaved({ ...values, isCurrent: true });
    setTouched(false);
    setSuccess(true);
    await onSaved();
    setSaving(false);
  }

  return (
    <div className="edkut-card overflow-hidden">
      <div className="edkut-card-title">avalie {firstName}</div>
      <div className="flex flex-col gap-2.5 p-3.5">
        <p className="text-xs text-edkut-muted">
          Dê notas de 0 a 100. O que aparece no perfil é a média das notas de todos os amigos; ninguém vê a nota individual de
          ninguém. Você pode mudar a sua quando quiser.
        </p>

        {saved && !saved.isCurrent && (
          <p role="status" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
            Sua avaliação anterior era de uma amizade desfeita e não está sendo contada. Salve de novo para ela voltar a valer.
          </p>
        )}

        {INDICATOR_ROWS.map((row) => {
          const inputId = `rate-${ratedId}-${row.key}`;
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={inputId} className="font-heading text-[11px] font-bold tracking-wide" style={{ color: row.color }}>
                  {row.label}
                </label>
                <span className="font-heading text-sm font-black text-edkut-text">{values[row.key]}%</span>
              </div>
              <input
                id={inputId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={values[row.key]}
                disabled={saving}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, [row.key]: Number(e.target.value) }));
                  setTouched(true);
                  setSuccess(false);
                  setError(null);
                }}
                className="w-full"
                style={{ accentColor: row.color }}
              />
            </div>
          );
        })}

        {error && (
          <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
            {error}
          </p>
        )}
        {success && !touched && (
          <p role="status" className="rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-2.5 py-1.5 text-xs text-edkut-blue">
            Avaliação salva! Os indicadores acima já foram atualizados.
          </p>
        )}

        <button type="button" onClick={handleSave} disabled={!canSave} className="edkut-btn-pink disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "salvando..." : saved ? "atualizar avaliação" : "salvar avaliação"}
        </button>
      </div>
    </div>
  );
}
