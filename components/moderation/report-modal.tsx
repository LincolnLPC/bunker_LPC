"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, AlertTriangle } from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"

interface ReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportedUserId: string
  reportedUserName?: string
  roomId?: string
}

const REPORT_TYPES = [
  { value: "cheating", label: "Читерство" },
  { value: "harassment", label: "Оскорбления/Троллинг" },
  { value: "spam", label: "Спам" },
  { value: "inappropriate_content", label: "Неуместный контент" },
  { value: "other", label: "Другое" },
] as const

export function ReportModal({
  open,
  onOpenChange,
  reportedUserId,
  reportedUserName,
  roomId,
}: ReportModalProps) {
  const [reportType, setReportType] = useState<string>("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!reportType || !description.trim()) {
      setError("Пожалуйста, выберите тип жалобы и опишите проблему")
      return
    }

    if (description.trim().length < 10) {
      setError("Описание должно содержать минимум 10 символов")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; report: any }>(
        "/api/moderation/report",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId,
            roomId: roomId || null,
            reportType,
            description: description.trim(),
          }),
        }
      )

      if (fetchError) {
        throw new Error(fetchError.message || "Не удалось отправить жалобу")
      }

      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        // Reset form
        setReportType("")
        setDescription("")
        setSuccess(false)
        setError(null)
      }, 2000)
    } catch (err) {
      console.error("Error submitting report:", err)
      setError(err instanceof Error ? err.message : "Не удалось отправить жалобу")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
      // Reset form after a short delay to allow dialog close animation
      setTimeout(() => {
        setReportType("")
        setDescription("")
        setError(null)
        setSuccess(false)
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Пожаловаться на игрока
          </DialogTitle>
          <DialogDescription>
            {reportedUserName
              ? `Вы собираетесь пожаловаться на игрока "${reportedUserName}".`
              : "Вы собираетесь пожаловаться на игрока."}
            <br />
            Пожалуйста, опишите проблему подробно. Жалоба будет рассмотрена модераторами.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/50 text-green-600 dark:text-green-400 text-sm">
              Жалоба успешно отправлена. Спасибо за обратную связь!
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="report-type">Тип жалобы *</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="report-type" disabled={loading || success}>
                <SelectValue placeholder="Выберите тип жалобы" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание проблемы *</Label>
            <Textarea
              id="description"
              placeholder="Опишите проблему подробно (минимум 10 символов)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || success}
              rows={5}
              minLength={10}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/1000 символов
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading || success}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || success || !reportType || description.trim().length < 10}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : success ? (
              "Отправлено"
            ) : (
              "Отправить жалобу"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
