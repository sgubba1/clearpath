"use client";

import { useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { resetDemoData, switchIdentity } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IDENTITIES, type Identity } from "@/lib/identities";

export function RoleSwitcher({ current }: { current: Identity }) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-auto py-1.5" aria-label={`Viewing as ${current.name}, ${current.roleLabel}. Switch role`}>
          <span className="flex flex-col items-start text-left leading-tight">
            <span className="text-sm font-medium">{current.name}</span>
            <span className="text-xs text-muted-foreground">
              {isPending ? "One moment…" : current.roleLabel}
            </span>
          </span>
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>View the app as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current.id}
          onValueChange={(id) => {
            if (id === current.id) return;
            startTransition(() => switchIdentity(id));
          }}
        >
          {IDENTITIES.map((identity) => (
            <DropdownMenuRadioItem key={identity.id} value={identity.id} className="items-start py-2">
              <span className="flex flex-col">
                <span className="font-medium">{identity.name}</span>
                <span className="text-xs text-muted-foreground">
                  {identity.roleLabel}
                  {identity.role === "affiliate" ? ` · ${identity.organization}` : ""}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (window.confirm("Reset the demo data? Every ad, comment and decision goes back to how it started, for everyone using this demo.")) {
              startTransition(() => resetDemoData());
            }
          }}
          className="text-muted-foreground"
        >
          Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
