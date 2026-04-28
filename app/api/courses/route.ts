import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getBoss } from "@/lib/queue/boss";

const CreateCourseSchema = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().min(1).max(200),
  documentIds: z.array(z.string()).min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      topic: true,
      emoji: true,
      status: true,
      createdAt: true,
      _count: { select: { chapters: true } },
    },
  });

  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = CreateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, topic, documentIds } = parsed.data;

  // Verify documents belong to this user
  const docs = await prisma.document.findMany({
    where: { id: { in: documentIds }, userId },
    select: { id: true, status: true },
  });

  if (docs.length !== documentIds.length) {
    return NextResponse.json({ error: "One or more documents not found" }, { status: 400 });
  }

  const course = await prisma.course.create({
    data: { userId, title, topic, status: "generating" },
  });

  // Link documents to course
  await prisma.document.updateMany({
    where: { id: { in: documentIds }, userId },
    data: { courseId: course.id },
  });

  // Enqueue curriculum generation
  const boss = await getBoss();
  await boss.send("generate-curriculum", { courseId: course.id });

  return NextResponse.json({ courseId: course.id }, { status: 201 });
}
