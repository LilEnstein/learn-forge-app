import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { BookOpen, Upload, MessageCircle, Trophy, User, Flame, Settings } from "lucide-react";
import { Mascot } from "@/components/mascots/Mascot";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NavigationOverlay } from "@/components/loading/NavigationOverlay";
import { CompanionBubble } from "@/components/companion/CompanionBubble";
import type { AvatarKey } from "@/lib/mascots/config";

const navItems = [
  { href: "/app/dashboard", icon: BookOpen, label: "Dashboard" },
  { href: "/app/upload", icon: Upload, label: "Upload" },
  { href: "/app/companion", icon: MessageCircle, label: "Companion" },
  { href: "/app/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/app/profile", icon: User, label: "Profile" },
  { href: "/app/settings", icon: Settings, label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarKey: true },
  });
  const avatarKey = userRecord?.avatarKey ?? "owl";

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationOverlay avatarKey={avatarKey as AvatarKey} />
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card px-4 py-6 gap-2">
        <Link href="/app/dashboard" className="flex items-center gap-2 px-2 mb-6">
          <span className="text-2xl">🔥</span>
          <span className="text-xl font-bold text-primary">LearnForge</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <Mascot avatarKey={avatarKey} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name ?? "Learner"}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between border-b px-4 h-14">
          <Link href="/app/dashboard" className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="font-bold text-primary">LearnForge</span>
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
        </header>

        <div className="flex-1 p-6">{children}</div>
        <CompanionBubble userId={session.user.id} />
      </main>
    </div>
  );
}
