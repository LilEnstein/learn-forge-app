export type ProgressStep =
  | 'upload'
  | 'parse'
  | 'chunk'
  | 'embed'
  | 'curriculum'
  | 'exercises'
  | 'done'
  | 'error'

export interface ProgressEvent {
  step: ProgressStep
  message: string
  progress?: number
  detail?: string
  timestamp: number
  courseId?: string
}
