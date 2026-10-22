"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
