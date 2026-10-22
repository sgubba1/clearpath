import Link from "next/link";
import { RoleSwitcher } from "@/components/role-switcher";
import type { Identity, Role } from "@/lib/identities";
import { getIdentity } from "@/lib/session";

// Only links to pages that exist; later milestones add entries here.
const NAV: Record<Role, { href: string; label: string }[]> = {
  marketer: [{ href: "/ads", label: "My ads" }],
  affiliate: [{ href: "/ads", label: "My ads" }],
  reviewer: [{ href: "/queue", label: "Review queue" }],
  manager: [{ href: "/dashboard", label: "Team overview" }],
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
          {identity && <Nav identity={identity} />}
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

function Nav({ identity }: { identity: Identity }) {
  return (
    <nav aria-label="Main" className="flex gap-4 text-sm">
      {NAV[identity.role].map((item) => (
        <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
