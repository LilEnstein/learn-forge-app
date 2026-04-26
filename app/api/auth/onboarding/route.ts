import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  topic: z.string().min(1),
  dailyGoalMin: z.number().int().min(5).max(60),
  avatarKey: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { dailyGoalMin, avatarKey } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingDone: true, dailyGoalMin, avatarKey },
  });

  return NextResponse.json({ ok: true });
}
