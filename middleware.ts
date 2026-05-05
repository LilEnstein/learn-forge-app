import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

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
