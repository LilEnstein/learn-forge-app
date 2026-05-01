"use client";

import { usePathname } from "next/navigation";

export type CompanionContext =
  | { type: "lesson"; courseId: string; lessonId: string }
  | { type: "map"; courseId: string }
  | { type: "general" };

export function parseCompanionContext(pathname: string): CompanionContext {
  const lessonMatch = pathname.match(/\/app\/learn\/([^/]+)\/lesson\/([^/]+)/);
  if (lessonMatch) {
    return { type: "lesson", courseId: lessonMatch[1], lessonId: lessonMatch[2] };
  }
  const mapMatch = pathname.match(/\/app\/learn\/([^/]+)$/);
  if (mapMatch) {
    return { type: "map", courseId: mapMatch[1] };
  }
  return { type: "general" };
}

export function useCompanionContext(): CompanionContext {
  const pathname = usePathname();
  return parseCompanionContext(pathname);
}
