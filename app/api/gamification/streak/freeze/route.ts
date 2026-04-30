import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { consumeFreeze } from "@/lib/gamification/streak";
import { NoFreezesError } from "@/lib/errors";

export async function POST() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await consumeFreeze(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NoFreezesError) {
      return NextResponse.json({ error: "No streak freezes available" }, { status: 400 });
    }
    throw err;
  }
}
