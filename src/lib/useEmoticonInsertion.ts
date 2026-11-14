"use client";

import { useEffect, useRef } from "react";
import { EmoticonDef, insertAtCursor } from "@/lib/emoticons";

/**
 * Liga um <input>/<textarea> controlado ao seletor de emoticons:
 *   const { ref, rememberSelection, insert } = useEmoticonInsertion<HTMLInputElement>(text, setText);
 *   <input ref={ref} onBlur={rememberSelection} onKeyUp={rememberSelection} onClick={rememberSelection} ... />
 *   <EmoticonPicker onSelect={insert} />
 * O emoticon entra na posição do cursor (ou no lugar do texto selecionado) e o foco volta ao campo.
 * Serve igualmente para scraps e depoimentos.
 */
export function useEmoticonInsertion<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  setValue: (next: string) => void
) {
  const ref = useRef<T>(null);
  const selection = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const pendingCaret = useRef<number | null>(null);

  /** Guarda onde estava o cursor (o campo perde o foco ao abrir o seletor). */
  function rememberSelection() {
    const el = ref.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function insert(def: EmoticonDef) {
    const { start, end } = selection.current;
    const result = insertAtCursor(value, start, end, def.code);
    pendingCaret.current = result.caret;
    selection.current = { start: result.caret, end: result.caret };
    setValue(result.value);
  }

  // Depois que o React aplicar o novo valor: devolve o foco e posiciona o cursor.
  useEffect(() => {
    const caret = pendingCaret.current;
    const el = ref.current;
    if (caret === null || !el) return;
    pendingCaret.current = null;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [value]);

  return { ref, rememberSelection, insert };
}
