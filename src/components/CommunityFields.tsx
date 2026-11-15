"use client";

import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_LONG_DESCRIPTION_MAX,
  COMMUNITY_NAME_MAX,
  JOIN_POLICY_LABEL,
  type CommunityFields as Fields,
} from "@/lib/communities";
import type { JoinPolicy } from "@/types";

interface CommunityFieldsProps {
  value: Fields;
  onChange: (next: Fields) => void;
  categories: string[];
  disabled?: boolean;
  /** Prefixo para ids únicos quando há mais de um formulário na tela. */
  idPrefix: string;
}

const POLICY_HELP: Record<JoinPolicy, string> = {
  open: "Qualquer usuário do edkut entra na hora.",
  approval: "A pessoa solicita e o criador ou um moderador aprova. A comunidade continua aparecendo na busca.",
};

/** Campos compartilhados de criar e editar comunidade (nome, descrições, categoria, tipo de entrada). */
export function CommunityFields({ value, onChange, categories, disabled = false, idPrefix }: CommunityFieldsProps) {
  const set = <K extends keyof Fields>(key: K, v: Fields[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor={`${idPrefix}-name`}>
        nome
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={COMMUNITY_NAME_MAX}
          disabled={disabled}
          className="edkut-input font-normal"
          placeholder="nome da comunidade"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor={`${idPrefix}-desc`}>
        descrição curta
        <textarea
          id={`${idPrefix}-desc`}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={COMMUNITY_DESCRIPTION_MAX}
          rows={2}
          disabled={disabled}
          className="edkut-input resize-none font-normal"
          placeholder="do que esta comunidade trata?"
        />
        <span className="text-[11px] font-normal text-edkut-muted">
          {Array.from(value.description).length}/{COMMUNITY_DESCRIPTION_MAX}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor={`${idPrefix}-long`}>
        descrição completa <span className="font-normal text-edkut-muted">(opcional)</span>
        <textarea
          id={`${idPrefix}-long`}
          value={value.longDescription}
          onChange={(e) => set("longDescription", e.target.value)}
          maxLength={COMMUNITY_LONG_DESCRIPTION_MAX}
          rows={4}
          disabled={disabled}
          className="edkut-input font-normal"
          placeholder="regras, objetivos, quem deve participar..."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-edkut-text" htmlFor={`${idPrefix}-cat`}>
        categoria
        <select
          id={`${idPrefix}-cat`}
          value={value.category}
          onChange={(e) => set("category", e.target.value)}
          disabled={disabled}
          className="edkut-input font-normal"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="text-sm font-semibold text-edkut-text">tipo de entrada</legend>
        {(["open", "approval"] as JoinPolicy[]).map((p) => (
          <label key={p} className="flex items-start gap-2 text-sm text-edkut-text">
            <input
              type="radio"
              name={`${idPrefix}-policy`}
              value={p}
              checked={value.joinPolicy === p}
              onChange={() => set("joinPolicy", p)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">{p === "open" ? "aberta" : "mediante aprovação"}</span>{" "}
              <span className="text-[11px] text-edkut-muted">({JOIN_POLICY_LABEL[p]})</span>
              <span className="block text-xs text-edkut-muted">{POLICY_HELP[p]}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
