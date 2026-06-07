"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DropZone } from "@/components/upload/DropZone"
import { ProcessingStatus } from "@/components/upload/ProcessingStatus"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function UploadPageClient() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [topic, setTopic] = useState("")
  const [processing, setProcessing] = useState<{ docId: string; courseId: string } | null>(null)

  if (processing) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Đang xử lý tài liệu</h1>
          <p className="text-muted-foreground mt-1">
            AI đang phân tích và xây dựng lộ trình học cho bạn.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ProcessingStatus
              docId={processing.docId}
              onComplete={(courseId) => router.push(`/app/learn/${courseId}`)}
              onError={() => setProcessing(null)}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Create a course</h1>
        <p className="text-muted-foreground mt-1">
          Upload your learning materials. AI will generate a curriculum automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course details</CardTitle>
          <CardDescription>Give your course a title and topic.</CardDescription>
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
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="e.g. Machine Learning"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload materials</CardTitle>
          <CardDescription>PDF, DOCX, TXT, or Markdown files.</CardDescription>
        </CardHeader>
        <CardContent>
          <DropZone
            courseName={title.trim() || "New course"}
            topic={topic.trim() || "general"}
            minFiles={1}
            onUploadSuccess={(docId, courseId) => setProcessing({ docId, courseId })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
