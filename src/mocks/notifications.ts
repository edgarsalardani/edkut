import { AppNotification } from "@/types";

export const notifications: AppNotification[] = [
  {
    id: "n1",
    userId: "u1",
    kind: "friend_accept",
    message: "Marina aceitou sua solicitação de amizade.",
    actorId: "u2",
    createdAt: "2026-09-13T21:00:00.000Z",
    read: false,
  },
  {
    id: "n2",
    userId: "u1",
    kind: "comment",
    message: "Lucas comentou sua publicação.",
    actorId: "u3",
    targetId: "p1",
    createdAt: "2026-09-13T18:40:00.000Z",
    read: false,
  },
  {
    id: "n3",
    userId: "u1",
    kind: "scrap",
    message: "Você recebeu um novo scrap.",
    actorId: "u4",
    createdAt: "2026-09-12T18:30:00.000Z",
    read: false,
  },
  {
    id: "n4",
    userId: "u1",
    kind: "testimonial",
    message: "João deixou um depoimento para você.",
    actorId: "u7",
    createdAt: "2026-09-11T12:00:00.000Z",
    read: true,
  },
  {
    id: "n5",
    userId: "u1",
    kind: "community_post",
    message: "Nova publicação em IHC e Usabilidade.",
    actorId: "u4",
    targetId: "c2",
    createdAt: "2026-09-08T15:50:00.000Z",
    read: true,
  },
  {
    id: "n6",
    userId: "u1",
    kind: "friend_request",
    message: "Carolina Prestes quer se conectar com você.",
    actorId: "u16",
    createdAt: "2026-09-07T09:12:00.000Z",
    read: true,
  },
  {
    id: "n7",
    userId: "u1",
    kind: "comment",
    message: "Beatriz comentou sua publicação.",
    actorId: "u4",
    targetId: "p9",
    createdAt: "2026-09-13T10:05:00.000Z",
    read: false,
  },
  {
    id: "n8",
    userId: "u1",
    kind: "community_post",
    message: "Nova publicação em Meu código funciona, não sei por quê.",
    actorId: "u7",
    targetId: "c10",
    createdAt: "2026-09-12T11:15:00.000Z",
    read: true,
  },
];

export function getNotificationsForUser(userId: string): AppNotification[] {
  return notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
