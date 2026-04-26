import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAppRoute = req.nextUrl.pathname.startsWith("/app");
  if (isAppRoute && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
