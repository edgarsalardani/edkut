import { AppShell } from "@/components/AppShell";
import { HomeClassicView } from "@/components/HomeClassicView";
import { getCurrentUser } from "@/services/authService";
import { getFriendsOf } from "@/services/socialService";
import { getHomeData } from "@/services/homeService";

/**
 * Home no estilo do perfil clássico. Só mostra dados REAIS (perfil, status, indicadores, amigos, comunidades, recados
 * e solicitações pendentes). O feed de publicações dos amigos ainda não existe: aparece como um aviso discreto,
 * nunca como posts fictícios.
 */
export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const [friends, data] = await Promise.all([getFriendsOf(currentUser.id), getHomeData(currentUser.id)]);

  return (
    <AppShell>
      <HomeClassicView currentUser={currentUser} friends={friends} data={data} />
    </AppShell>
  );
}
