"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { CommunityInfo, CommunityMemberInfo, CommunityRole, JoinRequestInfo, User } from "@/types";
import { Avatar, UserAvatar } from "./Avatar";
import { CommunityFields } from "./CommunityFields";
import { CommunityImageField } from "./CommunityImageField";
import { formatRelativeTime } from "@/lib/format";
import {
  JOIN_POLICY_LABEL,
  cancelJoinRequest,
  canModerate,
  decideJoinRequest,
  isMemberStatus,
  joinCommunity,
  myStatusIn,
  removeCommunityImage,
  removeMembership,
  requestJoin,
  setCommunityImage,
  setMemberRole,
  updateCommunity,
  validateCommunityFields,
  type CommunityFields as Fields,
} from "@/lib/communities";

type Tab = "membros" | "administracao";

interface CommunityPageClientProps {
  initialCommunity: CommunityInfo;
  categories: string[];
  initialMembers: CommunityMemberInfo[];
  initialPeople: User[];
  initialRole?: CommunityRole;
  initialPending: boolean;
  initialRequests: JoinRequestInfo[];
  membersTruncated: boolean;
  currentUser: User;
  imageWarning?: boolean;
}

function toFields(c: CommunityInfo): Fields {
  return { name: c.name, description: c.description, longDescription: c.longDescription ?? "", category: c.category, joinPolicy: c.joinPolicy };
}

export function CommunityPageClient({
  initialCommunity,
  categories,
  initialMembers,
  initialPeople,
  initialRole,
  initialPending,
  initialRequests,
  membersTruncated,
  currentUser,
  imageWarning = false,
}: CommunityPageClientProps) {
  const [community, setCommunity] = useState(initialCommunity);
  const [members, setMembers] = useState(initialMembers);
  const [people, setPeople] = useState(() => new Map(initialPeople.map((p) => [p.id, p])));
  const [role, setRole] = useState<CommunityRole | undefined>(initialRole);
  const [pending, setPending] = useState(initialPending);
  const [requests, setRequests] = useState(initialRequests);
  const [memberCount, setMemberCount] = useState(initialCommunity.memberCount);

  const [tab, setTab] = useState<Tab>("membros");
  const [busy, setBusy] = useState<string | null>(null); // ação em andamento (evita duplo clique)
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(imageWarning ? "A comunidade foi criada, mas a imagem não pôde ser enviada. Você pode tentar de novo em administração." : null);
  const [confirming, setConfirming] = useState<string | null>(null); // "leave" | "remove:<id>"
  const busyRef = useRef(false); // trava síncrona: dois cliques seguidos não disparam duas chamadas

  const status = myStatusIn(community, currentUser.id, role, pending);
  const isCreator = status === "creator";
  const isMod = canModerate(status);
  const isMember = isMemberStatus(status);
  const creator = community.creatorId ? people.get(community.creatorId) : undefined;
  const isOpen = community.joinPolicy === "open";

  const sortedMembers = useMemo(() => {
    const rank = (m: CommunityMemberInfo) => (m.userId === community.creatorId ? 0 : m.role === "moderator" ? 1 : 2);
    return [...members].sort((a, b) => rank(a) - rank(b) || Date.parse(a.joinedAt) - Date.parse(b.joinedAt));
  }, [members, community.creatorId]);

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key);
    setError(null);
    setNotice(null);
    const result = await action();
    busyRef.current = false;
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível concluir a ação.");
      return;
    }
    onOk();
  }

  const addSelf = () => {
    setPeople((prev) => new Map(prev).set(currentUser.id, currentUser));
    setMembers((prev) => [...prev.filter((m) => m.userId !== currentUser.id), { userId: currentUser.id, role: "member", joinedAt: new Date().toISOString() }]);
    setRole("member");
    setMemberCount((n) => n + 1);
  };

  function handleJoin() {
    void run("join", () => joinCommunity(community.id), () => {
      addSelf();
      setNotice("Você entrou na comunidade!");
    });
  }

  function handleRequest() {
    void run("request", () => requestJoin(community.id), () => {
      setPending(true);
      setNotice("Solicitação enviada. Você será membro quando o criador ou um moderador aprovar.");
    });
  }

  function handleCancelRequest() {
    void run("cancel", () => cancelJoinRequest(community.id), () => {
      setPending(false);
      setNotice("Solicitação cancelada.");
    });
  }

  function handleLeave() {
    void run("leave", () => removeMembership(community.id, currentUser.id), () => {
      setMembers((prev) => prev.filter((m) => m.userId !== currentUser.id));
      setRole(undefined);
      setMemberCount((n) => Math.max(n - 1, 0));
      setConfirming(null);
      setTab("membros");
      setNotice("Você saiu da comunidade.");
    });
  }

  function handleRemove(userId: string) {
    const name = people.get(userId)?.name ?? "participante";
    void run(`remove:${userId}`, () => removeMembership(community.id, userId), () => {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setMemberCount((n) => Math.max(n - 1, 0));
      setConfirming(null);
      setNotice(`${name} foi removido(a) da comunidade.`);
    });
  }

  function handleSetRole(userId: string, next: CommunityRole) {
    void run(`role:${userId}`, () => setMemberRole(community.id, userId, next), () => {
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: next } : m)));
      setNotice(next === "moderator" ? "Moderador definido." : "Moderador removido (voltou a ser participante).");
    });
  }

  function handleDecide(req: JoinRequestInfo, approve: boolean) {
    void run(`decide:${req.id}`, () => decideJoinRequest(req.id, approve), () => {
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (approve) {
        setMembers((prev) => (prev.some((m) => m.userId === req.userId) ? prev : [...prev, { userId: req.userId, role: "member", joinedAt: new Date().toISOString() }]));
        setMemberCount((n) => n + 1);
      }
      setNotice(approve ? "Solicitação aprovada: a pessoa agora é membro." : "Solicitação recusada.");
    });
  }

  const pendingCount = requests.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="edkut-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <Avatar emoji={community.emoji} color={community.color} imageUrl={community.imageUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-edkut-pink">{community.category}</p>
            <h1 className="break-words font-heading text-xl font-bold text-edkut-blue">{community.name}</h1>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-edkut-text">{community.longDescription ?? community.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-edkut-muted">
              <span>
                {memberCount.toLocaleString("pt-BR")} {memberCount === 1 ? "membro" : "membros"}
              </span>
              <span className="edkut-tag">{JOIN_POLICY_LABEL[community.joinPolicy]}</span>
              {creator ? (
                <span>
                  criada por{" "}
                  <Link href={`/profile/${creator.id}`} className="edkut-link">
                    {creator.name}
                  </Link>
                </span>
              ) : community.creatorId === null ? (
                <span>criador: conta excluída</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            {status === "none" && isOpen && (
              <button type="button" className="edkut-btn-pink whitespace-nowrap" onClick={handleJoin} disabled={busy !== null}>
                {busy === "join" ? "entrando..." : "entrar na comunidade"}
              </button>
            )}
            {status === "none" && !isOpen && (
              <button type="button" className="edkut-btn-pink whitespace-nowrap" onClick={handleRequest} disabled={busy !== null}>
                {busy === "request" ? "enviando..." : "solicitar participação"}
              </button>
            )}
            {status === "pending" && (
              <>
                <span className="edkut-tag text-center">solicitação enviada, aguardando aprovação</span>
                <button type="button" className="edkut-btn-outline whitespace-nowrap" onClick={handleCancelRequest} disabled={busy !== null}>
                  {busy === "cancel" ? "cancelando..." : "cancelar solicitação"}
                </button>
              </>
            )}
            {isCreator && <span className="edkut-tag text-center">você é o criador</span>}
            {status === "moderator" && <span className="edkut-tag text-center">você é moderador</span>}
            {(status === "member" || status === "moderator") &&
              (confirming === "leave" ? (
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-edkut-muted">Sair da comunidade?</span>
                  <button type="button" className="font-bold text-edkut-pinkDark hover:underline" onClick={handleLeave} disabled={busy !== null}>
                    {busy === "leave" ? "saindo..." : "sim, sair"}
                  </button>
                  <button type="button" className="edkut-link" onClick={() => setConfirming(null)} disabled={busy !== null}>
                    cancelar
                  </button>
                </span>
              ) : (
                <button type="button" className="edkut-btn-outline whitespace-nowrap" onClick={() => setConfirming("leave")} disabled={busy !== null}>
                  sair da comunidade
                </button>
              ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-3 py-2 text-sm text-edkut-blue">
          {notice}
        </p>
      )}

      {/* Abas */}
      <div className="flex gap-1 border-b border-edkut-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "membros"}
          onClick={() => setTab("membros")}
          className={`px-3 py-2 font-heading text-sm font-bold ${tab === "membros" ? "border-b-2 border-edkut-pink text-edkut-pink" : "text-edkut-muted hover:text-edkut-blue"}`}
        >
          membros ({memberCount})
        </button>
        {isMod && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "administracao"}
            onClick={() => setTab("administracao")}
            className={`px-3 py-2 font-heading text-sm font-bold ${tab === "administracao" ? "border-b-2 border-edkut-pink text-edkut-pink" : "text-edkut-muted hover:text-edkut-blue"}`}
          >
            administração{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        )}
      </div>

      {tab === "membros" && (
        <div className="edkut-card">
          <div className="edkut-card-title">membros</div>
          <ul className="divide-y divide-edkut-border px-3.5">
            {sortedMembers.map((m) => {
              const person = people.get(m.userId);
              const isCreatorRow = m.userId === community.creatorId;
              const isSelf = m.userId === currentUser.id;
              const label = isCreatorRow ? "criador" : m.role === "moderator" ? "moderador" : null;
              const canRemove = isMod && !isSelf && !isCreatorRow && m.role === "member";
              const canPromote = isCreator && !isSelf && !isCreatorRow;
              return (
                <li key={m.userId} className="flex flex-wrap items-center gap-2.5 py-2.5">
                  {person ? (
                    <Link href={`/profile/${person.id}`} aria-label={`Ver perfil de ${person.name}`}>
                      <UserAvatar user={person} size="sm" />
                    </Link>
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-edkut border border-edkut-border bg-edkut-blueSoft" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    {person ? (
                      <Link href={`/profile/${person.id}`} className="font-heading text-sm font-bold text-edkut-blue hover:underline">
                        {person.name}
                      </Link>
                    ) : (
                      <span className="font-heading text-sm font-bold text-edkut-muted">usuário indisponível</span>
                    )}{" "}
                    {isSelf && <span className="text-xs text-edkut-muted">(você)</span>}{" "}
                    {label && <span className="edkut-tag">{label}</span>}
                    <p className="text-[11px] text-edkut-faint">entrou {formatRelativeTime(m.joinedAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {canPromote &&
                      (m.role === "member" ? (
                        <button type="button" className="edkut-link" onClick={() => handleSetRole(m.userId, "moderator")} disabled={busy !== null}>
                          tornar moderador
                        </button>
                      ) : (
                        <button type="button" className="edkut-link" onClick={() => handleSetRole(m.userId, "member")} disabled={busy !== null}>
                          remover moderador
                        </button>
                      ))}
                    {canRemove &&
                      (confirming === `remove:${m.userId}` ? (
                        <>
                          <span className="text-edkut-muted">Remover?</span>
                          <button type="button" className="font-bold text-edkut-pinkDark hover:underline" onClick={() => handleRemove(m.userId)} disabled={busy !== null}>
                            {busy === `remove:${m.userId}` ? "removendo..." : "sim, remover"}
                          </button>
                          <button type="button" className="edkut-link" onClick={() => setConfirming(null)} disabled={busy !== null}>
                            cancelar
                          </button>
                        </>
                      ) : (
                        <button type="button" className="edkut-link" onClick={() => setConfirming(`remove:${m.userId}`)} disabled={busy !== null}>
                          remover
                        </button>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {membersTruncated && <p className="px-3.5 pb-3 text-xs text-edkut-muted">Mostrando os primeiros membros da comunidade.</p>}
          {sortedMembers.length === 0 && <p className="px-3.5 py-3 text-sm text-edkut-muted">Esta comunidade ainda não tem membros.</p>}
        </div>
      )}

      {tab === "administracao" && isMod && (
        <div className="flex flex-col gap-4">
          <RequestsPanel
            requests={requests}
            people={people}
            busy={busy}
            joinPolicy={community.joinPolicy}
            onDecide={handleDecide}
          />
          {isCreator ? (
            <EditPanel
              community={community}
              categories={categories}
              onSaved={(c, msg) => {
                setCommunity(c);
                setError(null);
                setNotice(msg);
              }}
            />
          ) : (
            <p className="edkut-card p-3.5 text-sm text-edkut-muted">
              Somente o criador edita os dados da comunidade e o tipo de entrada. Como moderador, você decide solicitações e remove participantes comuns.
            </p>
          )}
        </div>
      )}

      <p className="rounded-edkut border border-dashed border-edkut-border p-3 text-center text-xs text-edkut-muted">
        O fórum de discussões desta comunidade chega na próxima entrega.
      </p>
    </div>
  );
}

function RequestsPanel({
  requests,
  people,
  busy,
  joinPolicy,
  onDecide,
}: {
  requests: JoinRequestInfo[];
  people: Map<string, User>;
  busy: string | null;
  joinPolicy: CommunityInfo["joinPolicy"];
  onDecide: (r: JoinRequestInfo, approve: boolean) => void;
}) {
  return (
    <div className="edkut-card">
      <div className="edkut-card-title">solicitações de participação{requests.length > 0 ? ` (${requests.length})` : ""}</div>
      <div className="px-3.5">
        {joinPolicy === "open" && requests.length > 0 && (
          <p className="py-2 text-xs text-edkut-muted">Esta comunidade agora é aberta, mas estas solicitações continuam pendentes até você decidir.</p>
        )}
        {requests.length === 0 ? (
          <p className="py-3 text-sm text-edkut-muted">Nenhuma solicitação pendente.</p>
        ) : (
          <ul className="divide-y divide-edkut-border">
            {requests.map((r) => {
              const person = people.get(r.userId);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2.5 py-2.5">
                  {person ? (
                    <Link href={`/profile/${person.id}`} aria-label={`Ver perfil de ${person.name}`}>
                      <UserAvatar user={person} size="sm" />
                    </Link>
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-edkut border border-edkut-border bg-edkut-blueSoft" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-heading text-sm font-bold text-edkut-blue">{person?.name ?? "usuário indisponível"}</span>
                    <p className="text-[11px] text-edkut-faint">solicitou {formatRelativeTime(r.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="edkut-btn py-0.5 text-xs" onClick={() => onDecide(r, true)} disabled={busy !== null}>
                      {busy === `decide:${r.id}` ? "salvando..." : "aprovar"}
                    </button>
                    <button type="button" className="edkut-btn-outline py-0.5 text-xs" onClick={() => onDecide(r, false)} disabled={busy !== null}>
                      recusar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EditPanel({
  community,
  categories,
  onSaved,
}: {
  community: CommunityInfo;
  categories: string[];
  onSaved: (c: CommunityInfo, message: string) => void;
}) {
  const [fields, setFields] = useState<Fields>(toFields(community));
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    const invalid = validateCommunityFields(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const result = await updateCommunity(community.id, fields);
    if (!result.ok || !result.data) {
      savingRef.current = false;
      setSaving(false);
      setError(result.error ?? "Não foi possível salvar.");
      return;
    }
    let updated = result.data;
    let imageError: string | undefined;
    if (image) {
      const up = await setCommunityImage(community.id, image);
      if (up.ok) updated = { ...updated, imageUrl: up.data };
      else imageError = up.error;
    } else if (removeImage) {
      const rm = await removeCommunityImage(community.id);
      if (rm.ok) updated = { ...updated, imageUrl: undefined };
      else imageError = rm.error;
    } else {
      updated = { ...updated, imageUrl: community.imageUrl };
    }
    savingRef.current = false;
    setSaving(false);
    if (imageError) setError(`Dados salvos, mas a imagem não foi alterada: ${imageError}`);
    else {
      setImage(null);
      setRemoveImage(false);
    }
    setFields(toFields(updated));
    onSaved(updated, imageError ? "Dados da comunidade salvos." : "Comunidade atualizada.");
  }

  return (
    <form onSubmit={handleSave} className="edkut-card flex flex-col gap-3 p-3.5" noValidate aria-label="Editar comunidade">
      <h2 className="font-heading text-sm font-bold text-edkut-blue">editar comunidade (somente o criador)</h2>
      <CommunityImageField
        emoji={community.emoji}
        color={community.color}
        currentImageUrl={community.imageUrl}
        file={image}
        onFileChange={setImage}
        removeRequested={removeImage}
        onRemoveChange={setRemoveImage}
        disabled={saving}
      />
      <CommunityFields idPrefix="edit" value={fields} onChange={(next) => { setFields(next); setError(null); }} categories={categories} disabled={saving} />
      {error && (
        <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-2.5 py-1.5 text-xs text-edkut-pinkDark">
          {error}
        </p>
      )}
      <button type="submit" className="edkut-btn-pink self-start" disabled={saving}>
        {saving ? "salvando..." : "salvar alterações"}
      </button>
    </form>
  );
}
