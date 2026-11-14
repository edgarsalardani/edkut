// ---------------------------------------------------------------------------
// Emoticons clássicos (estilo mensageiros dos anos 2000) — catálogo e conversão de texto.
//
// Os desenhos são ORIGINAIS do EdKut (SVG em components/Emoticon.tsx); nenhum arquivo gráfico
// de terceiros é usado. O texto guardado continua sendo o código (":)", "(L)"...), então
// basta chamar <EmoticonText text={...} /> onde houver texto de usuário (comentários agora;
// scraps e depoimentos depois) — nada muda no formato dos dados nem no banco.
// ---------------------------------------------------------------------------

export type EmoticonId =
  | "feliz"
  | "triste"
  | "piscadinha"
  | "risada"
  | "lingua"
  | "surpreso"
  | "coracao"
  | "oculos"
  | "chorando";

export interface EmoticonDef {
  id: EmoticonId;
  /** Código principal (é o que o seletor insere no texto). */
  code: string;
  /** Variações aceitas ao ler o texto (ex.: com "nariz": ":-)"). */
  aliases: string[];
  label: string;
}

/** Ordem de exibição no seletor. */
export const EMOTICONS: readonly EmoticonDef[] = [
  { id: "feliz", code: ":)", aliases: [":-)"], label: "Feliz" },
  { id: "triste", code: ":(", aliases: [":-("], label: "Triste" },
  { id: "piscadinha", code: ";)", aliases: [";-)"], label: "Piscadinha" },
  { id: "risada", code: ":D", aliases: [":-D"], label: "Risada" },
  { id: "lingua", code: ":P", aliases: [":-P"], label: "Língua" },
  { id: "surpreso", code: ":O", aliases: [":-O"], label: "Surpreso" },
  { id: "coracao", code: "(L)", aliases: [], label: "Coração" },
  { id: "oculos", code: "(H)", aliases: [], label: "Óculos escuros" },
  { id: "chorando", code: ":'(", aliases: [":'-("], label: "Chorando" },
];

export type TextPart = { type: "text"; value: string } | { type: "emoticon"; def: EmoticonDef; raw: string };

// Todos os códigos (principal + variações), do mais longo para o mais curto: ":'(" antes de ":(".
const ALL_CODES: { code: string; lower: string; def: EmoticonDef }[] = EMOTICONS.flatMap((def) =>
  [def.code, ...def.aliases].map((code) => ({ code, lower: code.toLowerCase(), def }))
).sort((a, b) => b.code.length - a.code.length);

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(ch: string | undefined): boolean {
  return !!ch && WORD_CHAR.test(ch);
}

/**
 * Divide o texto em trechos de texto normal e emoticons.
 *  - Não diferencia maiúsculas/minúsculas (":d", "(l)").
 *  - Exige que o código NÃO esteja colado depois de uma letra/número ("Meta:Python" não vira ":P")
 *    e, nos códigos que terminam em letra (":D", ":P", ":O"), que NÃO venha letra/número logo depois.
 *  - O texto original é preservado integralmente (quebras de linha, espaços, outros símbolos).
 */
export function parseEmoticons(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let buffer = "";
  let i = 0;

  while (i < text.length) {
    let matched: { code: string; def: EmoticonDef } | null = null;

    // Só vale a pena testar se o caractere atual pode abrir um código.
    const ch = text[i];
    if (ch === ":" || ch === ";" || ch === "(") {
      for (const candidate of ALL_CODES) {
        if (text.slice(i, i + candidate.code.length).toLowerCase() !== candidate.lower) continue;
        const before = i > 0 ? text[i - 1] : undefined;
        const after = text[i + candidate.code.length];
        const endsWithLetter = /[A-Za-z]$/.test(candidate.code);
        if (isWordChar(before)) continue;
        if (endsWithLetter && isWordChar(after)) continue;
        matched = candidate;
        break;
      }
    }

    if (matched) {
      if (buffer) {
        parts.push({ type: "text", value: buffer });
        buffer = "";
      }
      parts.push({ type: "emoticon", def: matched.def, raw: text.slice(i, i + matched.code.length) });
      i += matched.code.length;
    } else {
      buffer += ch;
      i += 1;
    }
  }
  if (buffer) parts.push({ type: "text", value: buffer });
  return parts;
}

/**
 * Insere `code` na posição do cursor (ou no lugar da seleção). Coloca espaço antes/depois quando
 * necessário, para que o código seja reconhecido na hora de exibir ("oi" + ":D" => "oi :D ").
 * Devolve o novo valor e a posição onde o cursor deve ficar.
 */
export function insertAtCursor(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  code: string
): { value: string; caret: number } {
  const start = Math.min(Math.max(selectionStart ?? value.length, 0), value.length);
  const end = Math.min(Math.max(selectionEnd ?? start, start), value.length);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
  const inserted = `${needsLeadingSpace ? " " : ""}${code}${needsTrailingSpace ? " " : ""}`;

  return { value: before + inserted + after, caret: before.length + inserted.length };
}
