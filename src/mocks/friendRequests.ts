import { FriendRequest } from "@/types";

// Lista mutável apenas em memória (protótipo sem backend). Ver
// src/services/friendService.ts para as operações de aceitar/recusar.
export const friendRequests: FriendRequest[] = [
  {
    id: "fr1",
    fromUserId: "u13",
    toUserId: "u1",
    createdAt: "2026-09-12T08:30:00.000Z",
    status: "pending",
  },
  {
    id: "fr2",
    fromUserId: "u16",
    toUserId: "u1",
    createdAt: "2026-09-07T09:12:00.000Z",
    status: "pending",
  },
  {
    id: "fr3",
    fromUserId: "u14",
    toUserId: "u1",
    createdAt: "2026-09-05T10:00:00.000Z",
    status: "pending",
  },
  {
    id: "fr4",
    fromUserId: "u10",
    toUserId: "u8",
    createdAt: "2026-09-03T10:00:00.000Z",
    status: "pending",
  },
];

export function getPendingRequestsForUser(userId: string): FriendRequest[] {
  return friendRequests.filter((r) => r.toUserId === userId && r.status === "pending");
}
