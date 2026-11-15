import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { FriendGrid } from "@/components/FriendGrid";
import { getCurrentUser } from "@/services/authService";
import { getFriendsOf } from "@/services/socialService";

/**
 * Home. Só mostra dados REAIS: perfil, amigos (Supabase). O feed de publicações e as comunidades ainda não
 * foram integrados, então aparecem como aviso/estado vazio (nunca como posts ou comunidades fictícios).
 */
export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const friends = await getFriendsOf(currentUser.id);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_1fr_250px]">
        <aside className="flex flex-col gap-3 lg:order-1">
          <ProfileCard user={currentUser} />
        </aside>

        <section className="flex flex-col gap-3 lg:order-2">
          <div className="rounded-edkut border border-edkut-border bg-white px-3.5 py-2.5">
            <h1 className="font-heading text-base font-bold text-edkut-blue">
              Olá, {currentUser.name.split(" ")[0]}!{" "}
              <span className="font-normal text-edkut-muted">que bom ter você no edkut.</span>
            </h1>
          </div>

          <div className="edkut-card">
            <div className="edkut-card-title">novidades</div>
            <div className="p-4 text-sm text-edkut-muted">
              <p>As publicações ainda não estão disponíveis nesta versão do edkut.</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                <li>
                  <Link href="/search" className="edkut-link font-semibold">Encontre pessoas</Link> e envie solicitações de amizade.
                </li>
                <li>
                  <Link href="/scraps" className="edkut-link font-semibold">Veja seus scraps</Link> e deixe recados no perfil dos seus amigos.
                </li>
                <li>
                  <Link href="/testimonials" className="edkut-link font-semibold">Veja seus depoimentos</Link> e aprove os que quiser mostrar.
                </li>
                <li>
                  <Link href="/profile/edit" className="edkut-link font-semibold">Complete seu perfil</Link>.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-3 lg:order-3">
          <FriendGrid
            friends={friends.slice(0, 6)}
            title="amigos"
            viewAllHref="/friends"
            columns={3}
            emptyMessage="Você ainda não tem amigos."
            emptyAction={{ href: "/search", label: "buscar pessoas" }}
          />
        </aside>
      </div>
    </AppShell>
  );
}
