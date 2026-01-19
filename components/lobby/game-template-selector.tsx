"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, FileText, Trash2, Crown, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface GameTemplate {
  id: string
  name: string
  description: string | null
  max_players: number
  round_mode: "manual" | "automatic"
  discussion_time: number
  voting_time: number
  auto_reveal: boolean
  spectators: boolean
  host_role: "host_and_player" | "host_only"
  catastrophe: string | null
  bunker_description: string | null
  exclude_non_binary_gender: boolean
  characteristics_settings: Record<string, any>
  custom_characteristics: Record<string, any>
  created_at: string
}

interface GameTemplateSelectorProps {
  onSelectTemplate: (template: GameTemplate) => void
  onSaveTemplate: (name: string, description: string) => Promise<void>
  subscriptionTier: "basic" | "premium"
  currentSettings?: any // Current game settings to save
}

export function GameTemplateSelector({
  onSelectTemplate,
  onSaveTemplate,
  subscriptionTier,
  currentSettings,
}: GameTemplateSelectorProps) {
  const [templates, setTemplates] = useState<GameTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const canCreateTemplates = subscriptionTier === "premium"

  useEffect(() => {
    if (canCreateTemplates) {
      loadTemplates()
    }
  }, [canCreateTemplates])

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/game-templates")
      if (!response.ok) {
        throw new Error("Failed to load templates")
      }
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveClick = async () => {
    if (!canCreateTemplates) {
      setError("Templates are only available for premium users")
      return
    }

    if (!templateName.trim()) {
      setError("Название шаблона обязательно")
      return
    }

    if (!currentSettings) {
      setError("Нет настроек для сохранения")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSaveTemplate(templateName.trim(), templateDescription.trim())
      setSaveDialogOpen(false)
      setTemplateName("")
      setTemplateDescription("")
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот шаблон?")) {
      return
    }

    try {
      const response = await fetch(`/api/game-templates/${templateId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete template")
      }

      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template")
    }
  }

  if (!canCreateTemplates) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Шаблоны игр
          </CardTitle>
          <CardDescription>
            Сохранение шаблонов доступно только для Премиум пользователей
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-primary border-primary/50">
            <Crown className="w-3 h-3 mr-1" />
            Премиум функция
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Шаблоны игр
            </CardTitle>
            <CardDescription>Загрузите сохраненные настройки или сохраните текущие</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>У вас пока нет сохраненных шаблонов</p>
            <p className="text-sm mt-1">Создайте первый шаблон, чтобы быстро настраивать игры</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{template.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {template.max_players} игроков
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(template.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectTemplate(template)}
                  >
                    Загрузить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Сохранить текущие настройки как шаблон
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Сохранение шаблона</DialogTitle>
              <DialogDescription>
                Введите название и описание для сохранения текущих настроек игры
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Название шаблона *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Например: Классическая игра"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="template-description">Описание (необязательно)</Label>
                <Textarea
                  id="template-description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Краткое описание настроек..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleSaveClick}
                disabled={!templateName.trim() || saving || !currentSettings}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
