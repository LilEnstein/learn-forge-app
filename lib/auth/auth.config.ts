import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config. This is the ONLY auth config the middleware imports,
 * so it must not pull in Prisma, bcrypt, or any Node-only API — the middleware
 * runs on the Edge runtime where those crash (MIDDLEWARE_INVOCATION_FAILED).
 *
 * It contains just enough to decode the JWT session and shape req.auth:
 *   - secret + jwt strategy  → middleware can read the signed token
 *   - OAuth providers        → edge-compatible (no DB at import)
 *   - jwt/session callbacks  → pass through values already in the token (NO db)
 *
 * The full config (lib/auth/config.ts) spreads this and adds the Prisma adapter,
 * the Credentials provider (DB lookup), and the DB-writing callbacks/events.
 */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // Edge-safe: only read/propagate values already on the token. The full
    // config's jwt callback (which queries Prisma on sign-in) runs in Node and
    // populates these; here we just carry them through so middleware sees them.
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "user";
      session.user.tier = (token.tier as string) ?? "free";
      return session;
    },
  },
} satisfies NextAuthConfig;
