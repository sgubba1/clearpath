// Demo identities for the role switcher. There is no real auth in this prototype:
// picking an identity sets a cookie, and every page reads it to decide what to show.
// All people and partners are made up.

export type Role = "marketer" | "affiliate" | "reviewer" | "manager";

export type Identity = {
  id: string;
  name: string;
  role: Role;
  roleLabel: string;
  organization: string;
  summary: string;
  home: string;
};

export const IDENTITIES = [
  {
    id: "maya",
    name: "Maya Alvarez",
    role: "marketer",
    roleLabel: "Growth marketer",
    organization: "ClearPath Financial",
    summary: "Writes email, SMS and social ads for loans, cards and mortgage prequal.",
    home: "/ads",
  },
  {
    id: "brightpath",
    name: "Jordan Reyes",
    role: "affiliate",
    roleLabel: "Affiliate partner",
    organization: "BrightPath Rates",
    summary: "A comparison site promoting ClearPath offers. Sees only its own ads.",
    home: "/ads",
  },
  {
    id: "dev",
    name: "Dev Patel",
    role: "reviewer",
    roleLabel: "Compliance reviewer",
    organization: "ClearPath Financial",
    summary: "Reviews every ad against lending ad rules before it runs.",
    home: "/queue",
  },
  {
    id: "priya",
    name: "Priya Shah",
    role: "manager",
    roleLabel: "Compliance manager",
    organization: "ClearPath Financial",
    summary: "Owns the team, the queue and exam readiness.",
    home: "/dashboard",
  },
] as const satisfies readonly Identity[];

export type IdentityId = (typeof IDENTITIES)[number]["id"];

export const IDENTITY_COOKIE = "cp_identity";

export function findIdentity(id: string | undefined): Identity | undefined {
  return IDENTITIES.find((identity) => identity.id === id);
}
