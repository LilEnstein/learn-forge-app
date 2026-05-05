import Link from "next/link";
import { ArrowLeft, KeyRound, LayoutDashboard, Mail, ShieldCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";

const adminNav = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/keys", icon: KeyRound, label: "Key Pool" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/requests", icon: Mail, label: "Upgrade Requests" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card px-4 py-6 gap-2">
        <div className="flex items-center gap-2 px-2 mb-6">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-primary">Admin</span>
        </div>

        <nav className="flex flex-col gap-1">
          {adminNav.map(({ href, icon: Icon, label }) => (
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
          <Link
            href="/app/dashboard"
            className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
          <div className="rounded-lg border bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{session.user.email}</p>
            <p className="text-xs text-primary">role: {session.user.role}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between border-b px-4 h-14">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">Admin</span>
          </div>
          <Link href="/app/dashboard" className="text-sm text-muted-foreground">
            Back to app
          </Link>
        </header>

        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
