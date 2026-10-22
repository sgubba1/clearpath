"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import { findIdentity, IDENTITY_COOKIE } from "@/lib/identities";
import { TOUR, TOUR_COOKIE } from "@/lib/tour";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

export async function switchIdentity(id: string) {
  const identity = findIdentity(id);
  if (!identity) throw new Error(`Unknown identity: ${id}`);

  const cookieStore = await cookies();
  cookieStore.set(IDENTITY_COOKIE, identity.id, COOKIE_OPTIONS);
  redirect(identity.home);
}

// Moves the guided tour to a step: becomes that step's person and opens its page.
export async function goToTourStep(index: number) {
  const step = TOUR[index];
  if (!step) throw new Error(`Unknown tour step: ${index}`);
  const cookieStore = await cookies();
  cookieStore.set(IDENTITY_COOKIE, step.identity, COOKIE_OPTIONS);
  cookieStore.set(TOUR_COOKIE, String(index), COOKIE_OPTIONS);
  redirect(step.href);
}

export async function endTour(finished: boolean) {
  const cookieStore = await cookies();
  cookieStore.delete(TOUR_COOKIE);
  redirect(finished ? "/?tour=done" : "/");
}

// Evaluators share one database, so anyone can put the demo back to its starting state.
// It also starts the visit over: no tour in progress and no person picked.
export async function resetDemoData() {
  await seedDatabase(getDb());
  const cookieStore = await cookies();
  cookieStore.delete(TOUR_COOKIE);
  cookieStore.delete(IDENTITY_COOKIE);
  redirect("/?reset=1");
}
