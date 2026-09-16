import { AppShell } from "@/components/AppShell";
import { FriendsPageClient } from "@/components/FriendsPageClient";
import { getCurrentUser } from "@/services/userService";
import { getFriendsOf, getPendingRequests } from "@/services/friendService";

export default async function FriendsPage() {
  const currentUser = await getCurrentUser();
  const [friends, requests] = await Promise.all([
    getFriendsOf(currentUser.id),
    getPendingRequests(currentUser.id),
  ]);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">amigos</h1>
        <p className="text-sm text-edkut-muted">
          Veja quem já está no edkut, aceite solicitações e encontre pessoas com interesses parecidos com os seus.
        </p>
      </div>

      <FriendsPageClient initialFriends={friends} initialRequests={requests} />
    </AppShell>
  );
}
