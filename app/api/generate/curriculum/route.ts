import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendJob } from "@/lib/queue/boss";

const Schema = z.object({ courseId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, userId: session.user.id },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.course.update({
    where: { id: course.id },
    data: { status: "generating" },
  });

  await sendJob("generate-curriculum", { courseId: course.id });

  return NextResponse.json({ queued: true });
}
