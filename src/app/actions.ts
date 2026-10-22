"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import { findIdentity, IDENTITY_COOKIE } from "@/lib/identities";

export async function switchIdentity(id: string) {
  const identity = findIdentity(id);
  if (!identity) throw new Error(`Unknown identity: ${id}`);

  const cookieStore = await cookies();
  cookieStore.set(IDENTITY_COOKIE, identity.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(identity.home);
}

// Evaluators share one database, so anyone can put the demo back to its starting state.
export async function resetDemoData() {
  await seedDatabase(getDb());
  redirect("/?reset=1");
}
