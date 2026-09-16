"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
  size?: "compact" | "large";
  placeholder?: string;
}

/** Busca global de pessoas, comunidades e publicações (ver seção 16 da spec). */
export function SearchBar({
  initialQuery = "",
  size = "compact",
  placeholder = "buscar pessoas, comunidades...",
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const isLarge = size === "large";

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar no EdKut"
        className={`edkut-input ${isLarge ? "py-2 text-base" : "py-1"}`}
      />
      <button type="submit" className={isLarge ? "edkut-btn-pink" : "edkut-btn-outline"}>
        buscar
      </button>
    </form>
  );
}
