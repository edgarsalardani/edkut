"use client";

import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "@/types";
import { USER_TYPE_LABEL } from "@/lib/userType";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { Avatar } from "./Avatar";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  FieldErrors,
  PROFILE_LIMITS,
  ProfileFormValues,
  UsernameStatus,
  charLength,
  checkUsernameAvailable,
  saveProfile,
  validateProfile,
} from "@/lib/profileEdit";

function toFormValues(user: User): ProfileFormValues {
  return {
    name: user.name,
    username: user.username,
    userType: user.userType,
    headline: user.headline,
    bio: user.bio,
    institution: user.institution ?? "",
    courseOrArea: user.courseOrArea ?? "",
    location: user.location ?? "",
    interestsText: user.interests.join(", "),
    avatarEmoji: user.avatarEmoji,
    avatarColor: user.avatarColor,
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="edkut-card overflow-hidden">
      <div className="edkut-card-title">{title}</div>
      {hint && <p className="border-b border-edkut-border px-3.5 py-1.5 text-xs text-edkut-muted">{hint}</p>}
      <div>{children}</div>
    </section>
  );
}

/** Uma linha "rótulo | campo" no estilo das tabelas de informações do perfil (linhas alternadas). */
function Row({
  label,
  htmlFor,
  error,
  help,
  index,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: ReactNode;
  index: number;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid gap-1 px-3.5 py-2.5 sm:grid-cols-[170px_1fr] sm:gap-3 ${
        index % 2 === 0 ? "bg-white" : "bg-edkut-blueSoft"
      }`}
    >
      <label htmlFor={htmlFor} className="text-sm font-semibold text-edkut-muted sm:pt-1.5 sm:text-right">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {help && <div className="mt-1 text-[11px] text-edkut-muted">{help}</div>}
        {error && (
          <p id={`${htmlFor}-erro`} role="alert" className="mt-1 text-xs font-semibold text-edkut-pinkDark">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Edição do PRÓPRIO perfil (/profile/edit). Estrutura inspirada no Orkut clássico: seções com título azul e
 * linhas "rótulo | campo". A foto reutiliza o ProfileAvatarEditor (upload/Storage já existentes).
 */
export function EditProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [saved, setSaved] = useState<ProfileFormValues>(() => toFormValues(user));
  const [values, setValues] = useState<ProfileFormValues>(() => toFormValues(user));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus | "checking" | "idle">("idle");
  const checkToken = useRef(0);

  const dirty = (Object.keys(values) as (keyof ProfileFormValues)[]).some((k) => values[k] !== saved[k]);

  // Avisa antes de sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Disponibilidade do username: confere (com pequena espera) ao digitar. Só uma checagem de conforto —
  // a garantia final é a constraint única do banco, tratada ao salvar.
  useEffect(() => {
    const candidate = values.username.trim().toLowerCase();
    if (candidate === saved.username || !/^[a-z0-9._]{3,30}$/.test(candidate)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const token = ++checkToken.current;
    const timer = setTimeout(async () => {
      const status = await checkUsernameAvailable(candidate, user.id);
      if (token === checkToken.current) setUsernameStatus(status);
    }, 450);
    return () => clearTimeout(timer);
  }, [values.username, saved.username, user.id]);

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleDiscard() {
    setValues(saved);
    setErrors({});
    setFormError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSuccess(false);

    const result = validateProfile(values);
    if (!result.ok || !result.clean) {
      setErrors(result.errors);
      setFormError("Revise os campos destacados antes de salvar.");
      return;
    }
    const clean = result.clean;

    setSaving(true);
    // Username alterado: confere de novo agora (o aviso ao digitar pode estar desatualizado).
    if (clean.username !== saved.username) {
      const status = await checkUsernameAvailable(clean.username, user.id);
      if (status === "taken") {
        setErrors({ username: "Este username já está em uso. Escolha outro." });
        setFormError("Revise os campos destacados antes de salvar.");
        setSaving(false);
        return;
      }
    }

    const saveResult = await saveProfile(clean);
    setSaving(false);
    if (!saveResult.ok) {
      if (saveResult.fieldErrors) setErrors(saveResult.fieldErrors);
      setFormError(saveResult.error ?? "Revise os campos destacados antes de salvar.");
      return;
    }

    // Reflete o que foi salvo (normalizado) no formulário e na linha de base.
    const normalized: ProfileFormValues = {
      ...values,
      name: clean.name,
      username: clean.username,
      headline: clean.headline,
      bio: clean.bio,
      institution: clean.institution ?? "",
      courseOrArea: clean.course_or_area ?? "",
      location: clean.location ?? "",
      interestsText: clean.interests.join(", "),
    };
    setValues(normalized);
    setSaved(normalized);
    setErrors({});
    setSuccess(true);
    router.refresh(); // Header, perfil e demais telas passam a mostrar os dados novos
  }

  const inputProps = (key: keyof ProfileFormValues) => ({
    id: id(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id(key)}-erro` : undefined,
    className: `edkut-input ${errors[key] ? "border-edkut-pink" : ""}`,
  });

  const count = (text: string, max: number) => (
    <span className={charLength(text) > max ? "font-bold text-edkut-pinkDark" : ""}>
      {charLength(text)}/{max}
    </span>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="edkut-card flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <h1 className="font-heading text-lg font-bold text-edkut-blue">editar perfil</h1>
          <p className="text-sm text-edkut-muted">Conte quem você é para a galera do edkut.</p>
        </div>
        <Link href={`/profile/${user.id}`} className="edkut-link text-sm font-bold">
          « voltar ao meu perfil
        </Link>
      </div>

      <Section title="foto" hint="Envie uma foto sua (JPEG, PNG ou WebP, até 2 MB). O envio é salvo na hora.">
        <div className="flex flex-col items-center gap-2 bg-white px-3.5 py-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="w-44">
            <ProfileAvatarEditor user={user} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-edkut-muted">sem foto?</p>
            <p className="mb-2 text-xs text-edkut-muted">
              Escolha o emoji e a cor do seu avatar padrão (aparece quando você não tem foto). Vale ao salvar o formulário.
            </p>
            <div className="mb-2 flex items-center gap-2">
              <Avatar emoji={values.avatarEmoji} color={values.avatarColor} size="md" />
              <span className="text-xs text-edkut-muted">pré-visualização</span>
            </div>
            <div role="group" aria-label="Emoji do avatar" className="mb-2 flex flex-wrap gap-1">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => update("avatarEmoji", emoji)}
                  aria-pressed={values.avatarEmoji === emoji}
                  aria-label={`Emoji ${emoji}`}
                  className={`h-8 w-8 rounded-edkut border text-base ${
                    values.avatarEmoji === emoji ? "border-edkut-pink bg-edkut-pinkSoft" : "border-edkut-border bg-white hover:bg-edkut-blueSoft"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Cor do avatar" className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update("avatarColor", color)}
                  aria-pressed={values.avatarColor === color}
                  aria-label={`Cor ${color}`}
                  className={`h-6 w-6 rounded-full border-2 ${values.avatarColor === color ? "border-edkut-text" : "border-white shadow-sm"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <Section title="informações básicas">
          <Row label="nome" htmlFor={id("name")} error={errors.name} index={0} help={<>{count(values.name, PROFILE_LIMITS.nameMax)}</>}>
            <input {...inputProps("name")} type="text" autoComplete="name" value={values.name} onChange={(e) => update("name", e.target.value)} />
          </Row>
          <Row
            label="username"
            htmlFor={id("username")}
            error={errors.username}
            index={1}
            help={
              <>
                letras minúsculas, números, ponto ou _ (3 a 30).{" "}
                {usernameStatus === "checking" && <span>verificando...</span>}
                {usernameStatus === "available" && <span className="font-bold text-edkut-green">disponível ✓</span>}
                {usernameStatus === "taken" && <span className="font-bold text-edkut-pinkDark">já está em uso</span>}
                {usernameStatus === "error" && <span>não foi possível verificar agora (confirmamos ao salvar)</span>}
              </>
            }
          >
            <input
              {...inputProps("username")}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={values.username}
              onChange={(e) => update("username", e.target.value.toLowerCase())}
            />
          </Row>
          <Row
            label="tipo de perfil"
            htmlFor={id("userType")}
            error={errors.userType}
            index={2}
            help="Você mesmo declara o tipo; o edkut ainda não verifica essa informação."
          >
            <select
              {...inputProps("userType")}
              value={values.userType}
              onChange={(e) => update("userType", e.target.value as ProfileFormValues["userType"])}
            >
              {Object.entries(USER_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="frase de apresentação" htmlFor={id("headline")} error={errors.headline} index={3} help={<>{count(values.headline, PROFILE_LIMITS.headlineMax)} · ex.: Professor | Pesquisador em IHC</>}>
            <input {...inputProps("headline")} type="text" value={values.headline} onChange={(e) => update("headline", e.target.value)} />
          </Row>
        </Section>

        <Section title="sobre você">
          <Row label="biografia" htmlFor={id("bio")} error={errors.bio} index={0} help={<>{count(values.bio, PROFILE_LIMITS.bioMax)}</>}>
            <textarea {...inputProps("bio")} rows={5} value={values.bio} onChange={(e) => update("bio", e.target.value)} placeholder="Escreva um pouco sobre você, o que estuda, o que curte..." />
          </Row>
          <Row label="interesses" htmlFor={id("interestsText")} error={errors.interestsText} index={1} help="Separe por vírgula. Até 20 interesses, 40 caracteres cada. Ex.: IHC, Inteligência Artificial, Web">
            <textarea {...inputProps("interestsText")} rows={2} value={values.interestsText} onChange={(e) => update("interestsText", e.target.value)} />
          </Row>
        </Section>

        <Section title="formação e localização">
          <Row label="instituição" htmlFor={id("institution")} error={errors.institution} index={0}>
            <input {...inputProps("institution")} type="text" value={values.institution} onChange={(e) => update("institution", e.target.value)} placeholder="Ex.: UFES" />
          </Row>
          <Row label="curso / área" htmlFor={id("courseOrArea")} error={errors.courseOrArea} index={1}>
            <input {...inputProps("courseOrArea")} type="text" value={values.courseOrArea} onChange={(e) => update("courseOrArea", e.target.value)} placeholder="Ex.: Ciência da Computação" />
          </Row>
          <Row label="localização" htmlFor={id("location")} error={errors.location} index={2}>
            <input {...inputProps("location")} type="text" value={values.location} onChange={(e) => update("location", e.target.value)} placeholder="Ex.: Vitória, ES" />
          </Row>
        </Section>

        <p className="px-1 text-[11px] text-edkut-muted">
          E-mail e senha não são alterados aqui. Seus indicadores NERD · PARCEIRO · TECH vêm das avaliações dos seus amigos e não podem ser editados.
        </p>

        {formError && (
          <p role="alert" className="rounded-edkut border border-edkut-pink bg-edkut-pinkSoft px-3 py-2 text-sm text-edkut-pinkDark">
            {formError}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-edkut border border-edkut-borderStrong bg-edkut-blueSoft px-3 py-2 text-sm text-edkut-blue">
            Perfil atualizado com sucesso!{" "}
            <Link href={`/profile/${user.id}`} className="edkut-link font-bold">
              ver meu perfil
            </Link>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving || !dirty} className="edkut-btn-pink px-6 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "salvando..." : "salvar alterações"}
          </button>
          <button type="button" onClick={handleDiscard} disabled={saving || !dirty} className="edkut-btn-outline disabled:cursor-not-allowed disabled:opacity-60">
            descartar alterações
          </button>
          <Link href={`/profile/${user.id}`} className="edkut-link ml-1 text-sm">
            cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
