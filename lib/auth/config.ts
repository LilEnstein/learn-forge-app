import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { z } from "zod";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Full (Node-runtime) config: spreads the edge-safe base and layers on the
// Prisma adapter, the Credentials provider (DB lookup), and the DB-writing
// callbacks/events. Used by route handlers and getSession — never by middleware.
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Bootstrap admins from env (idempotent on every sign-in)
      if (!user.id || !user.email) return true;
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (adminEmails.includes(user.email.toLowerCase())) {
        await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, tier: true },
        });
        token.role = dbUser?.role ?? "user";
        token.tier = dbUser?.tier ?? "free";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "user";
      session.user.tier = (token.tier as string) ?? "free";
      return session;
    },
  },
  events: {
    // Fires after Auth.js has written the new user row — safe to create related records
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.$transaction([
        prisma.userGamification.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        }),
        prisma.streakRecord.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        }),
      ]);
    },
  },
});
