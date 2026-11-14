"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { EMOTICONS, EmoticonDef } from "@/lib/emoticons";
import { Emoticon } from "./Emoticon";

const COLUMNS = 3;

interface EmoticonPickerProps {
  onSelect: (emoticon: EmoticonDef) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Botão com carinha + seletor de emoticons. Reutilizável em qualquer campo de texto.
 *
 * Teclado: Enter/Espaço no botão abre; setas/Home/End navegam pela grade; Enter/Espaço escolhe;
 * Esc fecha e devolve o foco ao botão; Tab para fora fecha. Mouse/toque: clique fora fecha.
 */
export function EmoticonPicker({ onSelect, disabled = false, className = "" }: EmoticonPickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();

  // Ao abrir, foca o primeiro emoticon.
  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clique/toque fora fecha.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  function moveTo(index: number) {
    const last = EMOTICONS.length - 1;
    const next = Math.min(Math.max(index, 0), last);
    setActive(next);
    itemRefs.current[next]?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveTo(active + 1 > EMOTICONS.length - 1 ? 0 : active + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveTo(active - 1 < 0 ? EMOTICONS.length - 1 : active - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveTo(active + COLUMNS);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveTo(active - COLUMNS);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(EMOTICONS.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false); // deixa o foco seguir naturalmente
        break;
    }
  }

  function choose(def: EmoticonDef) {
    setOpen(false);
    onSelect(def); // quem chama devolve o foco ao campo de texto
  }

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Inserir emoticon"
        title="Emoticons"
        className="flex h-8 w-8 items-center justify-center rounded-edkut border border-edkut-borderStrong bg-white hover:bg-edkut-blueSoft focus:outline-none focus:ring-2 focus:ring-edkut-pink/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Emoticon def={EMOTICONS[0]} size={20} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Escolha um emoticon"
          onKeyDown={handleKeyDown}
          className="absolute bottom-full right-0 z-30 mb-1 w-[11.5rem] max-w-[calc(100vw-2rem)] rounded-edkut border border-edkut-borderStrong bg-white p-1.5 shadow-edkut"
        >
          <div className="grid grid-cols-3 gap-1">
            {EMOTICONS.map((def, index) => (
              <button
                key={def.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                tabIndex={index === active ? 0 : -1}
                onClick={() => choose(def)}
                onFocus={() => setActive(index)}
                aria-label={`${def.label} ${def.code}`}
                title={`${def.label} ${def.code}`}
                className="flex flex-col items-center gap-0.5 rounded-edkut border border-transparent px-1 py-1.5 hover:border-edkut-pink hover:bg-edkut-blueSoft focus:border-edkut-pink focus:bg-edkut-blueSoft focus:outline-none"
              >
                <Emoticon def={def} size={26} />
                <span className="font-mono text-[10px] text-edkut-muted">{def.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
