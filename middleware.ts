import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

// Initialize Auth.js from the EDGE-SAFE config only (no Prisma/bcrypt), so the
// middleware can run on the Edge runtime without crashing. The full config in
// lib/auth/config.ts (with the Prisma adapter) is used by Node route handlers.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtected = path.startsWith("/app") || path.startsWith("/admin");
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
