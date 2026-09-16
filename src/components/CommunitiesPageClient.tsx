"use client";

import { FormEvent, useMemo, useState } from "react";
import { Community, CommunityCategory, User } from "@/types";
import { CommunityGrid } from "@/components/CommunityGrid";
import { communityCategories } from "@/mocks/communities";
import { createCommunity } from "@/services/communityService";

type Tab = "minhas" | "descobrir" | "populares";

const TAB_LABEL: Record<Tab, string> = {
  minhas: "minhas comunidades",
  descobrir: "descobrir",
  populares: "populares",
};

interface CommunitiesPageClientProps {
  initialCommunities: Community[];
  currentUser: User;
}

export function CommunitiesPageClient({ initialCommunities, currentUser }: CommunitiesPageClientProps) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [joinedIds, setJoinedIds] = useState(new Set(currentUser.communityIds));
  const [category, setCategory] = useState<CommunityCategory | "Todas">("Todas");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("minhas");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<CommunityCategory>("Geral");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communities.filter((c) => {
      const matchesCategory = category === "Todas" || c.category === category;
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [communities, category, query]);

  const tabCommunities = useMemo(() => {
    if (tab === "minhas") return filtered.filter((c) => joinedIds.has(c.id));
    if (tab === "descobrir") return filtered.filter((c) => !joinedIds.has(c.id));
    return [...filtered].sort((a, b) => b.memberCount - a.memberCount);
  }, [filtered, tab, joinedIds]);

  async function handleCreateCommunity(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newDescription.trim()) return;
    setCreating(true);
    const community = await createCommunity({
      name: newName.trim(),
      description: newDescription.trim(),
      category: newCategory,
      creatorId: currentUser.id,
    });
    setCommunities((prev) => [community, ...prev]);
    setJoinedIds((prev) => new Set(prev).add(community.id));
    setNewName("");
    setNewDescription("");
    setNewCategory("Geral");
    setShowCreateForm(false);
    setTab("minhas");
    setCreating(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="edkut-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar comunidades..."
          className="edkut-input flex-1"
          aria-label="Buscar comunidades"
        />
        <button onClick={() => setShowCreateForm((s) => !s)} className="edkut-btn-pink whitespace-nowrap">
          {showCreateForm ? "cancelar" : "criar comunidade"}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateCommunity} className="edkut-card flex flex-col gap-2.5 p-3.5">
          <h2 className="font-heading text-sm font-bold text-edkut-blue">criar nova comunidade</h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="nome da comunidade"
            className="edkut-input"
            required
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="descrição curta"
            rows={2}
            className="edkut-input resize-none"
            required
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as CommunityCategory)}
            className="edkut-input"
          >
            {communityCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button type="submit" className="edkut-btn-pink self-start" disabled={creating}>
            {creating ? "criando..." : "criar"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategory("Todas")}
          className={category === "Todas" ? "edkut-tag !bg-edkut-pink !text-white !border-edkut-pinkDark" : "edkut-tag"}
        >
          Todas
        </button>
        {communityCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={category === cat ? "edkut-tag !bg-edkut-pink !text-white !border-edkut-pinkDark" : "edkut-tag"}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-edkut-border">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-heading font-bold ${
              tab === t ? "border-b-2 border-edkut-pink text-edkut-pink" : "text-edkut-muted hover:text-edkut-blue"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <CommunityGrid
        communities={tabCommunities}
        emptyMessage={
          tab === "minhas"
            ? "Você ainda não entrou em nenhuma comunidade nesta categoria."
            : "Nenhuma comunidade encontrada."
        }
      />
    </div>
  );
}
