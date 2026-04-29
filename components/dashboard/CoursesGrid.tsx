"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Smile, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Course = {
  id: string;
  title: string;
  emoji: string;
  status: string;
};

const EMOJI_CHOICES = ["📚", "💻", "🧠", "🎨", "🔬", "📐", "🌍", "🎵", "🏛️", "🧪", "🚀", "📊"];

type DialogMode =
  | { kind: "rename"; course: Course }
  | { kind: "emoji"; course: Course }
  | { kind: "delete"; course: Course }
  | null;

type Toast = { id: number; message: string; tone: "success" | "error" };

export function CoursesGrid({ initial }: { initial: Course[] }) {
  const [courses, setCourses] = useState<Course[]>(initial);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  function pushToast(message: string, tone: Toast["tone"] = "success") {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }

  async function patchCourse(id: string, patch: Partial<Pick<Course, "title" | "emoji">>) {
    const prev = courses;
    setCourses((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Update failed");
      pushToast("Course updated");
    } catch (err) {
      setCourses(prev);
      pushToast((err as Error).message, "error");
    }
  }

  async function deleteCourse(id: string) {
    const prev = courses;
    setCourses((cs) => cs.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Delete failed");
      pushToast("Course deleted");
    } catch (err) {
      setCourses(prev);
      pushToast((err as Error).message, "error");
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onRename={() => setDialog({ kind: "rename", course })}
            onChangeEmoji={() => setDialog({ kind: "emoji", course })}
            onDelete={() => setDialog({ kind: "delete", course })}
          />
        ))}
      </div>

      {dialog?.kind === "rename" && (
        <RenameDialog
          course={dialog.course}
          onClose={() => setDialog(null)}
          onSave={(title) => {
            patchCourse(dialog.course.id, { title });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "emoji" && (
        <EmojiDialog
          course={dialog.course}
          onClose={() => setDialog(null)}
          onSave={(emoji) => {
            patchCourse(dialog.course.id, { emoji });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          course={dialog.course}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const target = dialog.course;
            setDialog(null);
            await deleteCourse(target.id);
          }}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
              t.tone === "success"
                ? "bg-green-600 text-white"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}

function CourseCard({
  course,
  onRename,
  onChangeEmoji,
  onDelete,
}: {
  course: Course;
  onRename: () => void;
  onChangeEmoji: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow h-full relative">
      <Link
        href={`/app/learn/${course.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg"
      >
        <CardHeader>
          <div className="text-3xl mb-2">{course.emoji}</div>
          <CardTitle className="text-base line-clamp-2 pr-8">{course.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              course.status === "ready"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {course.status === "ready" ? "Ready" : "Generating…"}
          </span>
        </CardContent>
      </Link>

      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Course options"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onChangeEmoji}>
              <Smile className="h-4 w-4" />
              Change icon
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete course
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function RenameDialog({
  course,
  onClose,
  onSave,
}: {
  course: Course;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(course.title);
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== course.title;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename course</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="course-title">Course title</Label>
          <Input
            id="course-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) onSave(trimmed);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(trimmed)} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmojiDialog({
  course,
  onClose,
  onSave,
}: {
  course: Course;
  onClose: () => void;
  onSave: (emoji: string) => void;
}) {
  const [emoji, setEmoji] = useState(course.emoji);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose an icon</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`text-2xl p-2 rounded-lg border-2 transition ${
                emoji === e
                  ? "border-violet-500 bg-violet-50"
                  : "border-transparent hover:bg-accent"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(emoji)} disabled={emoji === course.emoji}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  course,
  onClose,
  onConfirm,
}: {
  course: Course;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = confirm === course.title;

  async function handleDelete() {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete course</DialogTitle>
          <DialogDescription>
            This will permanently delete the course, all uploaded documents, chapters, lessons,
            and your progress. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-title">
            Type <span className="font-mono font-semibold">{course.title}</span> to confirm
          </Label>
          <Input
            id="confirm-title"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) handleDelete();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
