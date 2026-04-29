import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    emoji: z.string().min(1).max(8).optional(),
  })
  .refine((v) => v.title !== undefined || v.emoji !== undefined, {
    message: "Provide title or emoji",
  });

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: {
              progress: {
                where: { userId: session.user.id },
                select: { status: true, score: true, xpEarned: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.course.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, title: true, emoji: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: {
      id: true,
      documents: { select: { id: true, storagePath: true } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Document → Course is SetNull, not Cascade — delete docs explicitly first
  // so chunks cascade and files leave no orphans. Then delete the course;
  // Chapter / Lesson / Exercise / LessonProgress all cascade from there.
  await Promise.all(
    course.documents.map((d) => unlink(d.storagePath).catch(() => {}))
  );
  if (course.documents.length > 0) {
    await prisma.document.deleteMany({
      where: { id: { in: course.documents.map((d) => d.id) } },
    });
  }
  await prisma.course.delete({ where: { id: course.id } });

  return new NextResponse(null, { status: 204 });
}
