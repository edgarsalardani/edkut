import { notFound } from "next/navigation";

/** Comunidades ainda não estão integradas ao Supabase: não existe comunidade para mostrar. */
export default function CommunityPage() {
  notFound();
}
