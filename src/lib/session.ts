import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findIdentity, IDENTITY_COOKIE, type Identity, type Role } from "./identities";

export async function getIdentity(): Promise<Identity | undefined> {
  const cookieStore = await cookies();
  return findIdentity(cookieStore.get(IDENTITY_COOKIE)?.value);
}

// Pages call this to keep each role in its own views. Without an identity the visitor
// goes to the picker; with the wrong one they go to their own home page.
export async function requireRole(allowed: Role[]): Promise<Identity> {
  const identity = await getIdentity();
  if (!identity) redirect("/");
  if (!allowed.includes(identity.role)) redirect(identity.home);
  return identity;
}
