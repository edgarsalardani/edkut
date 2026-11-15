"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommunityInfo, CommunityRole, User } from "@/types";
import { CommunityCard } from "@/components/CommunityCard";
import { CommunityFields } from "@/components/CommunityFields";
import { CommunityImageField } from "@/components/CommunityImageField";
import {
  createCommunity,
  filterCommunities,
  myStatusIn,
  validateCommunityFields,
  type CommunityFields as Fields,
} from "@/lib/communities";

type Tab = "minhas" | "descobrir" | "todas";

const TAB_LABEL: Record<Tab, string> = {
  minhas: "minhas comunidades",
  descobrir: "descobrir",
  todas: "todas",
};

const EMPTY_FIELDS: Fields = { name: "", description: "", longDescription: "", category: "Geral", joinPolicy: "open" };

interface CommunitiesPageClientProps {
  initialCommunities: CommunityInfo[];
  categories: string[];
  myRoles: Record<string, CommunityRole>;
  myPendingIds: string[];
  currentUser: User;
  loadError?: boolean;
  migrationMissing?: boolean;
}

export function CommunitiesPageClient({
  initialCommunities,
  categories,
  myRoles,
  myPendingIds,
  currentUser,
  loadError = false,
  migrationMissing = false,
}: CommunitiesPageClientProps) {
  const router = useRouter();
  const [communities, setCommunities] = useState(initialCommunities);
  const pendingSet = useMemo(() => new Set(myPendingIds), [myPendingIds]);
  const statusOf = (c: CommunityInfo) => myStatusIn(c, currentUser.id, myRoles[c.id], pendingSet.has(c.id));

  const hasMine = initialCommunities.some((c) => statusOf(c) !== "none" && statusOf(c) !== "pending");
  const [tab, setTab] = useState<Tab>(hasMine ? "minhas" : "todas");
  const [category, setCategory] = useState("Todas");
  const [query, setQuery] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [fields, setFields] = useState<Fields>({ ...EMPTY_FIELDS, category: categories.includes("Geral") ? "Geral" : categories[0] ?? "" });
  const [image, setImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => filterCommunities(communities, query, category), [communities, query, category]);
  const visible = useMemo(() => {
    const isMine = (c: CommunityInfo) => {
      const s = statusOf(c);
      return s === "creator" || s === "moderator" || s === "member";
    };
    if (tab === "minhas") return filtered.filter(isMine);
    if (tab === "descobrir") return filtered.filter((c) => !isMine(c));
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, tab, myRoles, pendingSet]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (creatingRef.current) return;
    const invalid = validateCommunityFields(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    const result = await createCommunity(fields, image);
    if (!result.ok || !result.data) {
      creatingRef.current = false;
      setCreating(false);
      setError(result.error ?? "Não foi possível criar a comunidade."); // os campos são mantidos
      return;
    }
    const { community, imageError } = result.data;
    setCommunities((prev) => [community, ...prev]);
    // Vai direto para a página da nova comunidade (o criador entra como moderador no banco).
    // Se só a imagem falhou, a comunidade existe: o aviso aparece lá pela URL.
    router.push(`/communities/${community.id}${imageError ? "?imagem=falhou" : ""}`);
  }

  const tabCount = (t: Tab) => communities.filter((c) => (t === "minhas" ? ["creator", "moderator", "member"].includes(statusOf(c)) : true)).length;

  return (
    <div className="flex flex-col gap-4">
      {migrationMissing && (
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
          As comunidades precisam das migrações 12 e 13 no Supabase. Aplique-as e atualize a página.
        </p>
      )}
      {loadError && (
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
          Não foi possível carregar as comunidades agora. Atualize a página para tentar de novo.
        </p>
      )}

      <div className="edkut-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar comunidades por nome ou descrição..."
          className="edkut-input flex-1"
          aria-label="Buscar comunidades"
        />
        <button type="button" onClick={() => setShowForm((s) => !s)} className="edkut-btn-pink whitespace-nowrap" aria-expanded={showForm} disabled={migrationMissing}>
          {showForm ? "cancelar" : "criar comunidade"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="edkut-card flex flex-col gap-3 p-3.5" noValidate aria-label="Criar nova comunidade">
          <h2 className="font-heading text-sm font-bold text-edkut-blue">criar nova comunidade</h2>
          <CommunityImageField emoji="💬" color="#1D4E89" file={image} onFileChange={setImage} disabled={creating} />
          <CommunityFields idPrefix="create" value={fields} onChange={(next) => { setFields(next); setError(null); }} categories={categories} disabled={creating} />
          {error && (
            <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
              {error}
            </p>
          )}
          <p className="text-[11px] text-edkut-muted">Você será o criador e moderador. Só o criador edita os dados e o tipo de entrada.</p>
          <button type="submit" className="edkut-btn-pink self-start" disabled={creating}>
            {creating ? "criando..." : "criar comunidade"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
        {["Todas", ...categories].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={category === cat ? "edkut-tag !bg-edkut-pink !text-white !border-edkut-pinkDark" : "edkut-tag"}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-edkut-border" role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 font-heading text-sm font-bold ${
              tab === t ? "border-b-2 border-edkut-pink text-edkut-pink" : "text-edkut-muted hover:text-edkut-blue"
            }`}
          >
            {TAB_LABEL[t]} {t === "minhas" ? `(${tabCount("minhas")})` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-edkut border border-dashed border-edkut-border p-6 text-center text-sm text-edkut-muted">
          {loadError || migrationMissing
            ? "Nada para mostrar agora."
            : communities.length === 0
              ? "Ainda não há comunidades. Crie a primeira!"
              : tab === "minhas"
                ? "Você ainda não participa de nenhuma comunidade (com este filtro). Veja a aba “descobrir”."
                : "Nenhuma comunidade encontrada."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((c) => (
            <CommunityCard key={c.id} community={c} status={statusOf(c)} />
          ))}
        </div>
      )}
    </div>
  );
}
