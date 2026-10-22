import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { RoleSwitcher } from "@/components/role-switcher";
import type { Role } from "@/lib/identities";
import { getIdentity } from "@/lib/session";

const NAV: Record<Role, { href: string; label: string }[]> = {
  marketer: [
    { href: "/ads", label: "My ads" },
    { href: "/rules", label: "Ad rules" },
  ],
  affiliate: [
    { href: "/ads", label: "My ads" },
    { href: "/rules", label: "Ad rules" },
  ],
  reviewer: [
    { href: "/queue", label: "Review queue" },
    { href: "/rules", label: "Ad rules" },
  ],
  manager: [
    { href: "/dashboard", label: "Team overview" },
    { href: "/rules", label: "Ad rules" },
  ],
};

export async function SiteHeader() {
  const identity = await getIdentity();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={identity?.home ?? "/"} className="font-semibold tracking-tight">
            ClearPath <span className="font-normal text-muted-foreground">Compliance Review</span>
          </Link>
          {identity && <NavLinks items={NAV[identity.role]} />}
        </div>
        {identity ? (
          <RoleSwitcher current={identity} />
        ) : (
          <span className="text-sm text-muted-foreground">Pick a role to start</span>
        )}
      </div>
    </header>
  );
}
