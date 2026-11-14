import type { ReactNode } from "react";
import { EMOTICONS, EmoticonDef, EmoticonId, TextPart, parseEmoticons } from "@/lib/emoticons";

const FACE = "#FFD83B";
const FACE_EDGE = "#D99A00";
const INK = "#3A2A00";

function Face({ children }: { children: ReactNode }) {
  return (
    <>
      <circle cx="12" cy="12" r="10.5" fill={FACE} stroke={FACE_EDGE} strokeWidth="1.2" />
      <ellipse cx="9" cy="6.2" rx="5" ry="2.6" fill="#fff" opacity="0.35" />
      {children}
    </>
  );
}

const Eyes = () => (
  <>
    <ellipse cx="8.6" cy="10" rx="1.4" ry="1.9" fill={INK} />
    <ellipse cx="15.4" cy="10" rx="1.4" ry="1.9" fill={INK} />
  </>
);

const stroke = { fill: "none", stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" as const };

/** Desenho (SVG) de cada emoticon. Originais do EdKut — nada copiado de outros mensageiros. */
function drawing(id: EmoticonId) {
  switch (id) {
    case "feliz":
      return (
        <Face>
          <Eyes />
          <path d="M7 14.2 Q12 19.6 17 14.2" {...stroke} />
        </Face>
      );
    case "triste":
      return (
        <Face>
          <Eyes />
          <path d="M7.6 17.4 Q12 12.8 16.4 17.4" {...stroke} />
        </Face>
      );
    case "piscadinha":
      return (
        <Face>
          <ellipse cx="8.6" cy="10" rx="1.4" ry="1.9" fill={INK} />
          <path d="M13.6 10.2 H17.2" {...stroke} />
          <path d="M7 14.2 Q12 19.6 17 14.2" {...stroke} />
        </Face>
      );
    case "risada":
      return (
        <Face>
          <path d="M6.9 10.8 Q8.6 8.2 10.3 10.8" {...stroke} />
          <path d="M13.7 10.8 Q15.4 8.2 17.1 10.8" {...stroke} />
          <path d="M6 13.4 H18 Q17 20.6 12 20.6 Q7 20.6 6 13.4 Z" fill={INK} />
          <path d="M8.8 18.4 Q12 16.2 15.2 18.4 Q14 20.2 12 20.2 Q10 20.2 8.8 18.4 Z" fill="#E8607A" />
        </Face>
      );
    case "lingua":
      return (
        <Face>
          <ellipse cx="8.6" cy="10" rx="1.4" ry="1.9" fill={INK} />
          <path d="M13.6 10.2 H17.2" {...stroke} />
          <path d="M7 14.6 H17" {...stroke} />
          <path d="M12.2 14.8 V18.2 A2.3 2.3 0 0 0 16.8 18.2 V14.8 Z" fill="#E8607A" stroke={INK} strokeWidth="1" />
        </Face>
      );
    case "surpreso":
      return (
        <Face>
          <circle cx="8.6" cy="9.8" r="2.1" fill="#fff" stroke={INK} strokeWidth="1" />
          <circle cx="15.4" cy="9.8" r="2.1" fill="#fff" stroke={INK} strokeWidth="1" />
          <circle cx="8.6" cy="9.8" r="0.9" fill={INK} />
          <circle cx="15.4" cy="9.8" r="0.9" fill={INK} />
          <ellipse cx="12" cy="17" rx="2.1" ry="2.9" fill={INK} />
        </Face>
      );
    case "coracao":
      return (
        <>
          <path
            d="M12 21.4 C4.6 15.6 2.4 11.6 2.4 8.3 A4.8 4.8 0 0 1 12 6.4 A4.8 4.8 0 0 1 21.6 8.3 C21.6 11.6 19.4 15.6 12 21.4 Z"
            fill="#E0245E"
            stroke="#A8123F"
            strokeWidth="1.2"
          />
          <ellipse cx="7.6" cy="8.2" rx="2.2" ry="1.4" fill="#fff" opacity="0.45" transform="rotate(-25 7.6 8.2)" />
        </>
      );
    case "oculos":
      return (
        <Face>
          <path d="M3.8 8.6 H11 V11.6 A3 3 0 0 1 8 14.4 H6.8 A3 3 0 0 1 3.8 11.4 Z" fill="#1E1E24" />
          <path d="M13 8.6 H20.2 V11.4 A3 3 0 0 1 17.2 14.4 H16 A3 3 0 0 1 13 11.6 Z" fill="#1E1E24" />
          <path d="M10.6 9.6 H13.4" stroke="#1E1E24" strokeWidth="1.4" />
          <path d="M5 9.6 L8 9.6" stroke="#fff" strokeWidth="0.9" opacity="0.5" />
          <path d="M7.2 16 Q12 19.8 16.8 16" {...stroke} />
        </Face>
      );
    case "chorando":
      return (
        <Face>
          <ellipse cx="8.6" cy="9.4" rx="1.4" ry="1.7" fill={INK} />
          <ellipse cx="15.4" cy="9.4" rx="1.4" ry="1.7" fill={INK} />
          <path d="M8.6 11.4 Q6.9 14.4 8.4 17" fill="none" stroke="#3B8EDB" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15.4 11.4 Q17.1 14.4 15.6 17" fill="none" stroke="#3B8EDB" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.4 18.4 Q12 14.8 15.6 18.4" {...stroke} />
        </Face>
      );
  }
}

/** Um emoticon desenhado em SVG, do tamanho do texto ao redor (1,35em) ou de `size` em px. */
export function Emoticon({ def, size, className = "" }: { def: EmoticonDef; size?: number; className?: string }) {
  const dimension = size ? { width: size, height: size } : undefined;
  return (
    <span
      role="img"
      aria-label={def.label}
      title={`${def.label} ${def.code}`}
      className={`inline-block shrink-0 align-[-0.3em] ${size ? "" : "h-[1.35em] w-[1.35em]"} ${className}`}
      style={dimension}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">
        {drawing(def.id)}
      </svg>
    </span>
  );
}

/**
 * Exibe um texto trocando os códigos (":)", "(L)"...) pelos emoticons. Texto comum continua igual.
 * Reutilizável em comentários, scraps e depoimentos: <EmoticonText text={comment.text} />.
 * Os trechos de texto são renderizados como texto React (nunca como HTML), então não há risco de injeção.
 */
export function EmoticonText({ text }: { text: string }) {
  const parts: TextPart[] = parseEmoticons(text);
  return (
    <>
      {parts.map((part, index) =>
        part.type === "text" ? <span key={index}>{part.value}</span> : <Emoticon key={index} def={part.def} />
      )}
    </>
  );
}

export { EMOTICONS };
