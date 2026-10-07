"use client";

import { ChevronsUpDown, LoaderCircle, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { useShell } from "./shell-provider";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : (parts[0]?.slice(0, 2) ?? "?");
  return letters.toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted type-micro text-muted-foreground"
    >
      {initials(name)}
    </span>
  );
}

/**
 * The signed-in user's menu at the foot of the sidebar: who you are, settings, sign out.
 * Authentication stays out of the way — this is the only always-visible trace of it.
 */
export function UserMenu({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { user } = useShell();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      // Even if the request failed, leave the app; the server rejects a revoked/missing session.
      onNavigate?.();
      router.replace("/sign-in?reason=signed-out");
      router.refresh();
    }
  }

  const trigger = (
    <DropdownMenuTrigger
      className={cn(
        "group/user flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors duration-120 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
        collapsed && "w-auto justify-center p-1",
      )}
      aria-label={`Account menu for ${user.name}`}
    >
      <Avatar name={user.name} />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate type-label text-foreground">{user.name}</span>
            <span className="block truncate type-caption text-subtle-foreground">{user.email}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
        </>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{user.name}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate type-label text-foreground">{user.name}</span>
          <span className="block truncate type-caption font-normal text-subtle-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" onClick={onNavigate}>
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={signingOut}
        >
          {signingOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
