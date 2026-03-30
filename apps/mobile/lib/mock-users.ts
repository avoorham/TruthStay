// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  username: string;
  name: string;
}

export type Permission = "Can Edit" | "Can Suggest" | "Can View";

export interface Collaborator {
  user: MockUser;
  role: "owner" | Permission;
}

// ─── Mock users ───────────────────────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  { id: "u1", username: "rachmat_h",  name: "Rachmat Hidayat" },
  { id: "u2", username: "rachid_b",   name: "Rachid Belhaj" },
  { id: "u3", username: "rachael_a",  name: "Rachael Adams" },
  { id: "u4", username: "rachel_lin", name: "Rachel Lin" },
  { id: "u5", username: "rachel_g",   name: "Rachel Green" },
  { id: "u6", username: "james_k",    name: "James Kowalski" },
  { id: "u7", username: "sofia_m",    name: "Sofia Martinez" },
  { id: "u8", username: "luca_b",     name: "Luca Bianchi" },
  { id: "u9", username: "nina_v",     name: "Nina Voronova" },
  { id: "u10", username: "tom_w",     name: "Tom Whitfield" },
];

// ─── Mock collaborators per trip ──────────────────────────────────────────────

const ME: MockUser = { id: "me", username: "you", name: "You" };

export const MOCK_COLLABORATORS: Record<string, Collaborator[]> = {
  "mock-1": [
    { user: ME,           role: "owner" },
    { user: MOCK_USERS[5], role: "Can Edit" },
    { user: MOCK_USERS[6], role: "Can View" },
  ],
  "mock-2": [
    { user: ME,           role: "owner" },
    { user: MOCK_USERS[7], role: "Can Edit" },
  ],
  "mock-3": [
    { user: ME, role: "owner" },
  ],
};

// ─── Search helper ────────────────────────────────────────────────────────────

export function searchUsers(query: string, exclude: string[]): MockUser[] {
  if (!query.trim()) return [];
  // If input looks like an email, don't show username suggestions
  if (query.includes("@")) return [];
  const q = query.toLowerCase();
  return MOCK_USERS.filter(
    u =>
      !exclude.includes(u.id) &&
      (u.username.toLowerCase().startsWith(q) || u.name.toLowerCase().includes(q)),
  );
}
