"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertCircle } from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"

interface CreateBanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  userName?: string
  onSuccess?: () => void
}

export function CreateBanModal({
  open,
  onOpenChange,
  userId: initialUserId,
  userName: initialUserName,
  onSuccess,
}: CreateBanModalProps) {
  const [userId, setUserId] = useState(initialUserId || "")
  const [userName, setUserName] = useState(initialUserName || "")
  const [reason, setReason] = useState("")
  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary")
  const [expiresAt, setExpiresAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update form when props change
  useEffect(() => {
    if (initialUserId) setUserId(initialUserId)
    if (initialUserName) setUserName(initialUserName)
  }, [initialUserId, initialUserName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!userId || !reason || !banType) {
      setError("Заполните все обязательные поля")
      return
    }

    if (banType === "temporary" && !expiresAt) {
      setError("Укажите дату истечения бана для временного бана")
      return
    }

    setLoading(true)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; ban: any }>(
        "/api/admin/bans",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            reason,
            banType,
            expiresAt: banType === "temporary" ? expiresAt : null,
          }),
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось создать бан")
        return
      }

      if (data?.success) {
        // Reset form
        setUserId("")
        setUserName("")
        setReason("")
        setBanType("temporary")
        setExpiresAt("")
        onSuccess?.()
        onOpenChange(false)
      } else {
        setError("Не удалось создать бан")
      }
    } catch (err) {
      console.error("Error creating ban:", err)
      setError("Произошла ошибка при создании бана")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError(null)
      setUserId("")
      setUserName("")
      setReason("")
      setBanType("temporary")
      setExpiresAt("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать бан пользователя</DialogTitle>
          <DialogDescription>
            Забанить пользователя на указанный период или навсегда.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="userId">ID пользователя *</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID пользователя"
              required
              disabled={loading || !!initialUserId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userName">Имя пользователя</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Имя пользователя (для справки)"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="banType">Тип бана *</Label>
            <Select value={banType} onValueChange={(value: "temporary" | "permanent") => setBanType(value)}>
              <SelectTrigger id="banType">
                <SelectValue placeholder="Выберите тип бана" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temporary">Временный</SelectItem>
                <SelectItem value="permanent">Постоянный</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {banType === "temporary" && (
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Дата истечения *</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Причина бана *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Опишите причину бана..."
              required
              disabled={loading}
              rows={4}
              minLength={5}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">От 5 до 500 символов</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать бан"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
