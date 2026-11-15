"use client";

import { EmoticonPicker } from "./EmoticonPicker";
import { useEmoticonInsertion } from "@/lib/useEmoticonInsertion";

interface EmoticonTextareaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  ariaLabel: string;
  invalid?: boolean;
  /** Foca o campo ao montar (usado no formulário de resposta, aberto por um clique). */
  autoFocus?: boolean;
}

/**
 * Área de texto com o seletor de emoticons do EdKut ao lado. O emoticon entra na posição do cursor
 * (o texto guardado continua sendo o código, ex.: ":)"; quem exibe usa <EmoticonText />). Emojis do
 * teclado do sistema também funcionam: são texto Unicode comum.
 */
export function EmoticonTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  disabled = false,
  ariaLabel,
  invalid = false,
  autoFocus = false,
}: EmoticonTextareaProps) {
  const emoticons = useEmoticonInsertion<HTMLTextAreaElement>(value, onChange);
  return (
    <div className="flex items-start gap-1.5">
      <textarea
        ref={emoticons.ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={emoticons.rememberSelection}
        onKeyUp={emoticons.rememberSelection}
        onClick={emoticons.rememberSelection}
        placeholder={placeholder}
        rows={rows}
        className="edkut-input min-w-0 flex-1 resize-none"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      />
      <EmoticonPicker onSelect={emoticons.insert} disabled={disabled} />
    </div>
  );
}
