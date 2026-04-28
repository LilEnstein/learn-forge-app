"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/upload/DropZone";
import { DocumentCard } from "@/components/upload/DocumentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadedDoc {
  docId: string;
  name: string;
  type: string;
  sizeBytes: number;
  status: "processing" | "ready" | "error";
}

export default function UploadPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUploaded(doc: UploadedDoc) {
    setDocs((prev) => [...prev, doc]);
  }

  function handleDocReady(docId: string) {
    setDocs((prev) =>
      prev.map((d) => (d.docId === docId ? { ...d, status: "ready" } : d))
    );
  }

  const readyDocs = docs.filter((d) => d.status === "ready");
  const canCreate = readyDocs.length > 0 && title.trim().length > 0 && topic.trim().length > 0;

  async function handleCreateCourse() {
    if (!canCreate || creating) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          topic: topic.trim(),
          documentIds: readyDocs.map((d) => d.docId),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create course");
        return;
      }

      router.push("/app/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upload documents</h1>
        <p className="text-muted-foreground mt-1">
          Upload your learning material and create a course from it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Upload files</CardTitle>
          <CardDescription>PDF, Word documents, or plain text files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone onUploaded={handleUploaded} />

          {docs.length > 0 && (
            <div className="space-y-2 mt-4">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.docId}
                  {...doc}
                  onReady={() => handleDocReady(doc.docId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {docs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Create your course</CardTitle>
            <CardDescription>
              Give your course a title and topic. AI will generate the curriculum once all
              documents are processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course title</Label>
              <Input
                id="title"
                placeholder="e.g. Introduction to Machine Learning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topic / subject area</Label>
              <Input
                id="topic"
                placeholder="e.g. Machine Learning, Data Science"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleCreateCourse}
              disabled={!canCreate || creating}
              className="w-full"
            >
              {creating ? "Creating course…" : "Create course"}
            </Button>

            {readyDocs.length < docs.length && (
              <p className="text-xs text-muted-foreground text-center">
                Waiting for {docs.length - readyDocs.length} document(s) to finish processing…
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
