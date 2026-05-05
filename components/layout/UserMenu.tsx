"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { Mascot } from "@/components/mascots/Mascot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AvatarKey } from "@/lib/mascots/config";

type UserMenuProps = {
  name: string | null;
  email: string;
  avatarKey: AvatarKey;
  role: string;
};

export function UserMenu({ name, email, avatarKey, role }: UserMenuProps) {
  const isAdmin = role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Mascot avatarKey={avatarKey} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name ?? "Learner"}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/app/profile">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="h-4 w-4" />
              Admin Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <div className="my-1 h-px bg-border" />
        <DropdownMenuItem
          destructive
          onSelect={(event) => {
            event.preventDefault();
            void signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
