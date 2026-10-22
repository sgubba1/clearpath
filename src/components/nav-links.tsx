"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Marks the section you're in, including its detail pages (/queue/29 is under Review queue).
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-4 text-sm">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("hover:text-foreground", active ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
