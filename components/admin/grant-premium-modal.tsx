"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Crown, AlertCircle } from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"

interface GrantPremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function GrantPremiumModal({ open, onOpenChange, onSuccess }: GrantPremiumModalProps) {
  const [email, setEmail] = useState("")
  const [durationDays, setDurationDays] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [result, setResult] = useState<{ message: string; expiresAt: string | null } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    setResult(null)

    try {
      const { data, error: fetchError } = await safeFetch<{
        success: boolean
        message: string
        expiresAt: string | null
        expiresAtFormatted: string
      }>("/api/admin/grant-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          durationDays: durationDays && durationDays > 0 ? durationDays : null,
        }),
      })

      if (fetchError) {
        // Try to get detailed error message from response
        // @ts-ignore - message might be in the error object
        const errorMessage = fetchError.message || fetchError.error || "Не удалось выдать премиум подписку"
        console.error("[GrantPremiumModal] Error details:", {
          error: fetchError,
          message: fetchError.message,
          errorText: fetchError.error,
        })
        setError(errorMessage)
        return
      }

      if (data?.success) {
        setSuccess(true)
        setResult({
          message: data.message || "Премиум подписка успешно выдана",
          expiresAt: data.expiresAtFormatted || (data.expiresAt ? new Date(data.expiresAt).toLocaleString("ru-RU") : "Никогда"),
        })
        setEmail("")
        setDurationDays(null)
        onSuccess?.()
      }
    } catch (err) {
      console.error("Error granting premium:", err)
      setError(err instanceof Error ? err.message : "Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setEmail("")
      setDurationDays(null)
      setError(null)
      setSuccess(false)
      setResult(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Выдача премиум подписки
          </DialogTitle>
          <DialogDescription>
            Выдайте премиум подписку пользователю по email. Оставьте срок пустым для постоянной подписки.
          </DialogDescription>
        </DialogHeader>

        {success && result ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/50">
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-primary">{result.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Срок действия: {result.expiresAt}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Закрыть</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email пользователя *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationDays">
                Срок действия (дней) <span className="text-muted-foreground">(необязательно)</span>
              </Label>
              <Input
                id="durationDays"
                type="number"
                min="1"
                value={durationDays || ""}
                onChange={(e) => {
                  const value = e.target.value
                  setDurationDays(value ? parseInt(value, 10) : null)
                }}
                placeholder="Оставьте пустым для постоянной подписки"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Оставьте пустым для постоянной премиум подписки. Укажите количество дней для временной подписки.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading || !email.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Выдача...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Выдать премиум
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
