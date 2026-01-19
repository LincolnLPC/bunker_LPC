"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"
import { createClient } from "@/lib/supabase/client"

interface ContactFormData {
  subject: string
  category: string
  message: string
  email?: string
}

export function ContactForm() {
  const [formData, setFormData] = useState<ContactFormData>({
    subject: "",
    category: "general",
    message: "",
    email: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Load user email if authenticated
  useEffect(() => {
    const loadUserEmail = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setFormData((prev) => ({ ...prev, email: user.email || "" }))
      }
    }
    loadUserEmail()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!formData.subject.trim()) {
      setError("Введите тему обращения")
      return
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      setError("Сообщение должно содержать минимум 10 символов")
      return
    }

    if (!userEmail && !formData.email) {
      setError("Введите ваш email для обратной связи")
      return
    }

    setLoading(true)

    try {
      const { data, error: fetchError } = await safeFetch<{
        success: boolean
        message: string
        ticketId?: string
      }>("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formData.subject,
          category: formData.category,
          message: formData.message,
          email: formData.email || userEmail,
        }),
      })

      if (fetchError || !data?.success) {
        const errorMessage =
          fetchError?.message || data?.message || "Произошла ошибка при отправке сообщения"
        setError(errorMessage)
        return
      }

      setSuccess(true)
      setFormData({
        subject: "",
        category: "general",
        message: "",
        email: userEmail || "",
      })
    } catch (err) {
      console.error("Error submitting contact form:", err)
      setError("Произошла ошибка при отправке сообщения. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Сообщение отправлено!</h3>
              <p className="text-muted-foreground">
                Спасибо за обращение. Мы получили ваше сообщение и ответим вам в ближайшее время.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false)
                setError(null)
              }}
            >
              Отправить еще одно сообщение
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle>Свяжитесь с нами</CardTitle>
        <CardDescription>
          Заполните форму ниже, и мы ответим вам как можно скорее.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email для обратной связи *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || userEmail || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              required
              disabled={loading || !!userEmail}
            />
            {userEmail && (
              <p className="text-xs text-muted-foreground">
                Используется email из вашего аккаунта
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Категория *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Общий вопрос</SelectItem>
                <SelectItem value="technical">Техническая проблема</SelectItem>
                <SelectItem value="billing">Вопрос по подписке</SelectItem>
                <SelectItem value="bug">Сообщить об ошибке</SelectItem>
                <SelectItem value="suggestion">Предложение</SelectItem>
                <SelectItem value="other">Другое</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Тема *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Кратко опишите суть вопроса"
              required
              disabled={loading}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Сообщение *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Опишите ваш вопрос или проблему подробно..."
              required
              disabled={loading}
              rows={6}
              minLength={10}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              От 10 до 2000 символов. Укажите как можно больше деталей, это поможет нам быстрее
              решить ваш вопрос.
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Отправить сообщение
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
