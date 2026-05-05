import Link from "next/link";
import { KeyRound, Mail, Users } from "lucide-react";

const cards = [
  {
    href: "/admin/keys",
    icon: KeyRound,
    title: "Key Pool",
    description: "Manage shared provider API keys, daily limits, and routing priorities.",
    phase: "Live",
  },
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    description: "View user list, change tiers (free / pro / byok), and promote admins.",
    phase: "Phase 5",
  },
  {
    href: "/admin/requests",
    icon: Mail,
    title: "Upgrade Requests",
    description: "Review and approve user requests to upgrade to the pro tier.",
    phase: "Phase 4",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-1">
        Internal control panel for key pool, users, and upgrade requests.
      </p>

      <div className="grid gap-4 md:grid-cols-3 mt-8">
        {cards.map(({ href, icon: Icon, title, description, phase }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border bg-card p-5 hover:border-primary hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{phase}</span>
            </div>
            <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
