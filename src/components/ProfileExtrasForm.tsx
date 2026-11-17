"use client";

import { FormEvent, useRef, useState } from "react";
import { saveExtras, saveStatus } from "@/lib/profileExtras";
import { HOBBIES_MAX, RELATIONSHIP_KEYS, RELATIONSHIP_LABEL, STATUS_MAX, charLength } from "@/lib/profileClassic";
import type { ProfileExtras } from "@/types";

/**
 * Dados pessoais do perfil clássico (migração 14): status, relacionamento, aniversário e hobbies.
 * Nome, localização, formação, área de atuação, bio e interesses continuam no formulário principal (sem duplicar campos).
 */
export function ProfileExtrasForm({ userId, initial, migrationMissing = false }: { userId: string; initial: ProfileExtras; migrationMissing?: boolean }) {
  const busy = useRef(false);
  const [status, setStatus] = useState(initial.statusPhrase ?? "");
  const [relationship, setRelationship] = useState<string>(initial.relationship ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [hobbies, setHobbies] = useState(initial.hobbies ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    // Dois updates simples (status e demais campos); se o primeiro falhar, o segundo nem é tentado.
    const s = await saveStatus(userId, status);
    const x = s.ok ? await saveExtras(userId, { relationship, birthday, hobbies }) : null;
    busy.current = false;
    setSaving(false);
    if (!s.ok) return setError(s.error ?? "Não foi possível salvar.");
    if (x && !x.ok) return setError(x.error ?? "Não foi possível salvar.");
    setSaved(true);
  }

  const dirty = () => setSaved(false);

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Informações pessoais do perfil" className="edkut-card flex flex-col gap-3 p-4">
      <h2 className="font-heading text-sm font-bold text-edkut-blue">mais sobre você</h2>
      {migrationMissing && (
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">
          Estes campos precisam da migração 14 no Supabase. Aplique-a e atualize a página.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor="x-status">
        frase de status <span className="font-normal text-edkut-muted">(aparece sob o seu nome; vazio remove)</span>
        <input id="x-status" className="edkut-input" value={status} onChange={(e) => { setStatus(e.target.value); dirty(); }} placeholder="Sou feito de luz, cor e alegria!" disabled={saving || migrationMissing} />
        <span className={`text-[11px] font-normal ${charLength(status.trim()) > STATUS_MAX ? "text-edkut-pinkDark" : "text-edkut-muted"}`}>{charLength(status.trim())}/{STATUS_MAX}</span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor="x-rel">
        relacionamento
        <select id="x-rel" className="edkut-input" value={relationship} onChange={(e) => { setRelationship(e.target.value); dirty(); }} disabled={saving || migrationMissing}>
          <option value="">(não informar)</option>
          {RELATIONSHIP_KEYS.map((k) => (
            <option key={k} value={k}>{RELATIONSHIP_LABEL[k]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor="x-bday">
        aniversário <span className="font-normal text-edkut-muted">(só o dia e o mês aparecem no perfil)</span>
        <input id="x-bday" type="date" min="1900-01-01" className="edkut-input sm:max-w-[200px]" value={birthday} onChange={(e) => { setBirthday(e.target.value); dirty(); }} disabled={saving || migrationMissing} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor="x-hobbies">
        hobbies
        <textarea id="x-hobbies" rows={3} className="edkut-input" value={hobbies} onChange={(e) => { setHobbies(e.target.value); dirty(); }} placeholder="xadrez, trilhas, café…" disabled={saving || migrationMissing} />
        <span className={`text-[11px] font-normal ${charLength(hobbies.trim()) > HOBBIES_MAX ? "text-edkut-pinkDark" : "text-edkut-muted"}`}>{charLength(hobbies.trim())}/{HOBBIES_MAX}</span>
      </label>

      {error && <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-xs text-edkut-pinkDark">{error}</p>}
      {saved && <p role="status" className="text-xs font-semibold text-edkut-green">Informações salvas!</p>}
      <button type="submit" className="edkut-btn-pink self-start" disabled={saving || migrationMissing}>{saving ? "salvando..." : "salvar informações"}</button>
    </form>
  );
}
