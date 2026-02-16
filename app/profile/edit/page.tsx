"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Flame, Loader2, Upload, Camera, Mic, RefreshCw, Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { mediaLog } from "@/lib/media-logger"

interface NotificationSettings {
  phaseChange: boolean
  invites: boolean
}

interface MediaSettings {
  autoRequestCamera: boolean
  autoRequestMicrophone: boolean
  defaultCameraEnabled: boolean
  defaultMicrophoneEnabled: boolean
  cameraDeviceId?: string | null
  microphoneDeviceId?: string | null
  vdoNinjaCameraUrl?: string | null
}

interface MediaDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

function EditProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [mediaSettings, setMediaSettings] = useState<MediaSettings>({
    autoRequestCamera: true,
    autoRequestMicrophone: true,
    defaultCameraEnabled: true,
    defaultMicrophoneEnabled: true,
    cameraDeviceId: null,
    microphoneDeviceId: null,
    vdoNinjaCameraUrl: null,
  })
  const [availableCameras, setAvailableCameras] = useState<MediaDevice[]>([])
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    phaseChange: true,
    invites: true,
  })
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profile) {
        setUsername(profile.username || "")
        setDisplayName(profile.display_name || "")
        setAvatarUrl(profile.avatar_url)
        
        // Загрузить настройки медиа, если они есть
        if (profile.media_settings) {
          setMediaSettings({
            autoRequestCamera: profile.media_settings.autoRequestCamera ?? true,
            autoRequestMicrophone: profile.media_settings.autoRequestMicrophone ?? true,
            defaultCameraEnabled: profile.media_settings.defaultCameraEnabled ?? true,
            defaultMicrophoneEnabled: profile.media_settings.defaultMicrophoneEnabled ?? true,
            cameraDeviceId: profile.media_settings.cameraDeviceId ?? null,
            microphoneDeviceId: profile.media_settings.microphoneDeviceId ?? null,
            vdoNinjaCameraUrl: profile.media_settings.vdoNinjaCameraUrl ?? null,
          })
        }
        if (profile.notification_settings) {
          const ns = profile.notification_settings as Record<string, boolean>
          setNotificationSettings({
            phaseChange: ns.phaseChange ?? true,
            invites: ns.invites ?? true,
          })
        }
        if (typeof profile.show_online_status === "boolean") {
          setShowOnlineStatus(profile.show_online_status)
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices
          .filter(device => device.kind === "videoinput" && device.deviceId && device.deviceId.trim() !== "")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Камера ${index + 1}`,
            kind: device.kind as MediaDeviceKind,
          }))
        const microphones = devices
          .filter(device => device.kind === "audioinput" && device.deviceId && device.deviceId.trim() !== "")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Микрофон ${index + 1}`,
            kind: device.kind as MediaDeviceKind,
          }))
        mediaLog.profileDevices({
          cameras: cameras.length,
          microphones: microphones.length,
          cameraLabels: cameras.map(c => c.label),
          microphoneLabels: microphones.map(m => m.label),
        })
        setAvailableCameras(cameras)
        setAvailableMicrophones(microphones)
      }
    } catch (err) {
      console.error("[Profile] Error loading media devices:", err)
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  // enumerateDevices возвращает пустой список камер, пока браузер не получил разрешение через getUserMedia.
  const requestMediaThenLoad = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return
    setDevicesLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((t) => t.stop())
      await loadDevices()
    } catch (err) {
      console.error("[Profile] getUserMedia failed:", err)
    } finally {
      setDevicesLoading(false)
    }
  }, [loadDevices])

  // Загрузить список доступных устройств при монтировании
  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      // Валидация данных
      if (!username || username.trim().length === 0) {
        throw new Error("Имя пользователя не может быть пустым")
      }

      if (username.length < 3) {
        throw new Error("Имя пользователя должно содержать минимум 3 символа")
      }

      // Очищаем username от недопустимых символов
      // Оставляем только буквы (русские и английские), цифры, подчеркивание, дефис и точку
      const sanitizedUsername = username
        .trim()
        .replace(/[^a-zA-Z0-9_а-яА-ЯёЁ\-\.]/g, "") // Удаляем все недопустимые символы
        .substring(0, 30) // Ограничиваем длину

      if (sanitizedUsername.length < 3) {
        throw new Error("Имя пользователя должно содержать минимум 3 символа после очистки от недопустимых символов")
      }

      // Используем очищенное имя пользователя
      const finalUsername = sanitizedUsername

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("Не авторизован. Пожалуйста, войдите в систему.")
      }

      let finalAvatarUrl = avatarUrl

      // Загрузить аватар если выбран новый файл
      if (avatarFile) {
        try {
          const fileExt = avatarFile.name.split(".").pop()
          const fileName = `${user.id}-${Date.now()}.${fileExt}`
          const filePath = `${fileName}`

          const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile, {
            upsert: true,
          })

          if (uploadError) {
            if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
              throw new Error(
                "Bucket 'avatars' не найден в Supabase Storage.\n\n" +
                "Чтобы исправить это:\n" +
                "1. Откройте: https://supabase.com/dashboard/project/pklwfuyxumtjbgyqlxsf/storage/buckets\n" +
                "2. Нажмите 'New bucket'\n" +
                "3. Имя: avatars, включите 'Public bucket'\n" +
                "4. Нажмите 'Create bucket'\n" +
                "5. Выполните скрипт scripts/007-setup-storage-bucket.sql в SQL Editor\n\n" +
                "Подробная инструкция: НАСТРОЙКА_STORAGE.md\n\n" +
                "Примечание: Вы можете сохранить профиль без аватара, просто не выбирайте файл."
              )
            }
            throw uploadError
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("avatars").getPublicUrl(filePath)

          finalAvatarUrl = publicUrl
        } catch (avatarError) {
          // Если ошибка связана с bucket, показываем понятное сообщение
          if (avatarError instanceof Error && avatarError.message.includes("Bucket 'avatars' не найден")) {
            throw avatarError
          }
          throw avatarError
        }
      }

      // Обновить профиль
      // Подготавливаем данные для обновления
      const updateData: any = {
        username: finalUsername,
        display_name: displayName || null,
        avatar_url: finalAvatarUrl,
      }

      // Добавляем media_settings только если колонка существует (чтобы не было ошибки)
      // Если колонки нет, она будет просто проигнорирована
      if (mediaSettings) {
        updateData.media_settings = mediaSettings
      }
      if (notificationSettings) {
        updateData.notification_settings = notificationSettings
      }
      updateData.show_online_status = showOnlineStatus

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id)
        .select()

      if (updateError) {
        console.error("Profile update error:", {
          code: updateError.code,
          message: updateError.message,
          hint: updateError.hint,
          details: updateError,
        })
        throw new Error(
          updateError.message || 
          updateError.hint || 
          `Ошибка обновления профиля: ${updateError.code || "неизвестная ошибка"}`
        )
      }

      if (!updatedProfile || updatedProfile.length === 0) {
        throw new Error("Профиль не был обновлен. Возможно, у вас нет прав на обновление или профиль не найден.")
      }

      // Проверяем, есть ли параметр returnTo для возврата в игру
      const returnTo = searchParams.get("returnTo")
      if (returnTo && returnTo.startsWith("/game/")) {
        // Возвращаем игрока в игру
        router.push(returnTo)
      } else {
        // Обычное перенаправление на страницу профиля
        router.push("/profile")
      }
    } catch (err) {
      console.error("Error saving profile:", {
        error: err,
        errorType: typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
      })
      
      let errorMessage = "Не удалось сохранить профиль"
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === "object" && err !== null) {
        errorMessage = JSON.stringify(err, null, 2)
      } else {
        errorMessage = String(err)
      }
      
      setError(errorMessage)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Flame className="h-12 w-12 text-primary animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href={searchParams.get("returnTo") || "/profile"}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Редактировать профиль</span>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Настройки профиля</CardTitle>
            <CardDescription>Измените информацию о вашем аккаунте</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                  {displayName?.[0] || username[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar" className="cursor-pointer">
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Загрузить аватар
                  </span>
                </Button>
              </Label>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Отображаемое имя</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ваше имя"
                maxLength={50}
              />
            </div>

            <Separator />

            {/* Notification Settings */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Уведомления
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Выберите, о каких событиях вы хотите получать уведомления (в игре и по приглашениям). Push-уведомления будут подключены позже.
                </p>
              </div>
              <div className="space-y-4 pl-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyPhaseChange" className="text-base cursor-pointer">
                      Смена фаз игры
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Уведомлять о переходе к голосованию, результатам раунда и т.д.
                    </p>
                  </div>
                  <Switch
                    id="notifyPhaseChange"
                    checked={notificationSettings.phaseChange}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, phaseChange: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyInvites" className="text-base cursor-pointer">
                      Приглашения в игру
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Уведомлять о приглашениях в комнаты от других игроков
                    </p>
                  </div>
                  <Switch
                    id="notifyInvites"
                    checked={notificationSettings.invites}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, invites: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showOnlineStatus" className="text-base cursor-pointer">
                      Показывать статус «В сети»
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Другие пользователи смогут видеть, онлайн вы или нет
                    </p>
                  </div>
                  <Switch
                    id="showOnlineStatus"
                    checked={showOnlineStatus}
                    onCheckedChange={setShowOnlineStatus}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Media Settings */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  Настройки камеры и микрофона
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Настройте поведение камеры и микрофона при входе в игру
                </p>
              </div>

              <div className="space-y-4 pl-2">
                {/* Auto Request Camera */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoRequestCamera" className="text-base cursor-pointer">
                      Автоматически запрашивать доступ к камере
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      При входе в игру автоматически запрашивать доступ к камере
                    </p>
                  </div>
                  <Switch
                    id="autoRequestCamera"
                    checked={mediaSettings.autoRequestCamera}
                    onCheckedChange={(checked) =>
                      setMediaSettings({ ...mediaSettings, autoRequestCamera: checked })
                    }
                  />
                </div>

                {/* Auto Request Microphone */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoRequestMicrophone" className="text-base cursor-pointer">
                      Автоматически запрашивать доступ к микрофону
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      При входе в игру автоматически запрашивать доступ к микрофону
                    </p>
                  </div>
                  <Switch
                    id="autoRequestMicrophone"
                    checked={mediaSettings.autoRequestMicrophone}
                    onCheckedChange={(checked) =>
                      setMediaSettings({ ...mediaSettings, autoRequestMicrophone: checked })
                    }
                  />
                </div>

                <Separator />

                {/* Default Camera Enabled */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="defaultCameraEnabled" className="text-base cursor-pointer">
                      Камера включена по умолчанию
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Камера будет включена автоматически после получения доступа
                    </p>
                  </div>
                  <Switch
                    id="defaultCameraEnabled"
                    checked={mediaSettings.defaultCameraEnabled}
                    onCheckedChange={(checked) =>
                      setMediaSettings({ ...mediaSettings, defaultCameraEnabled: checked })
                    }
                  />
                </div>

                {/* Default Microphone Enabled */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="defaultMicrophoneEnabled" className="text-base cursor-pointer">
                      Микрофон включен по умолчанию
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Микрофон будет включен автоматически после получения доступа
                    </p>
                  </div>
                  <Switch
                    id="defaultMicrophoneEnabled"
                    checked={mediaSettings.defaultMicrophoneEnabled}
                    onCheckedChange={(checked) =>
                      setMediaSettings({ ...mediaSettings, defaultMicrophoneEnabled: checked })
                    }
                  />
                </div>

                <Separator />

                {/* Camera Device Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="cameraDevice" className="text-base">
                        Выбрать камеру
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Выберите камеру, которую хотите использовать по умолчанию
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadDevices}
                      disabled={devicesLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${devicesLoading ? "animate-spin" : ""}`} />
                      Обновить
                    </Button>
                  </div>
                  {devicesLoading ? (
                    <div className="text-sm text-muted-foreground">Загрузка устройств...</div>
                  ) : availableCameras.length === 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                        Камеры не найдены. Браузер показывает список только после того, как вы разрешите доступ к камере.
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={requestMediaThenLoad}
                        disabled={devicesLoading || !navigator.mediaDevices?.getUserMedia}
                      >
                        Разрешить камеру и обновить список
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={mediaSettings.cameraDeviceId || "default"}
                      onValueChange={(value) =>
                        setMediaSettings({
                          ...mediaSettings,
                          cameraDeviceId: value === "default" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger id="cameraDevice" className="w-full">
                        <SelectValue placeholder="Выберите камеру" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">По умолчанию (автоматический выбор)</SelectItem>
                        {availableCameras.map((camera) => (
                          <SelectItem key={camera.deviceId} value={camera.deviceId}>
                            {camera.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Microphone Device Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="microphoneDevice" className="text-base">
                        Выбрать микрофон
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Выберите микрофон, который хотите использовать по умолчанию
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadDevices}
                      disabled={devicesLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${devicesLoading ? "animate-spin" : ""}`} />
                      Обновить
                    </Button>
                  </div>
                  {devicesLoading ? (
                    <div className="text-sm text-muted-foreground">Загрузка устройств...</div>
                  ) : availableMicrophones.length === 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                        Микрофоны не найдены. Браузер показывает список только после разрешения доступа.
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={requestMediaThenLoad}
                        disabled={devicesLoading || !navigator.mediaDevices?.getUserMedia}
                      >
                        Разрешить микрофон и обновить список
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={mediaSettings.microphoneDeviceId || "default"}
                      onValueChange={(value) =>
                        setMediaSettings({
                          ...mediaSettings,
                          microphoneDeviceId: value === "default" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger id="microphoneDevice" className="w-full">
                        <SelectValue placeholder="Выберите микрофон" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">По умолчанию (автоматический выбор)</SelectItem>
                        {availableMicrophones.map((microphone) => (
                          <SelectItem key={microphone.deviceId} value={microphone.deviceId}>
                            {microphone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Separator />

                {/* VDO.ninja Camera URL */}
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="vdoNinjaCameraUrl" className="text-base">
                      Ссылка на камеру VDO.ninja
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Укажите ссылку на камеру из сайта vdo.ninja (например: https://vdo.ninja/?view=abc123)
                    </p>
                  </div>
                  <Input
                    id="vdoNinjaCameraUrl"
                    type="url"
                    value={mediaSettings.vdoNinjaCameraUrl || ""}
                    onChange={(e) =>
                      setMediaSettings({
                        ...mediaSettings,
                        vdoNinjaCameraUrl: e.target.value.trim() || null,
                      })
                    }
                    placeholder="https://vdo.ninja/?view=..."
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Если указана ссылка VDO.ninja, она будет использоваться вместо обычной веб-камеры
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={saving || !username.trim()} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
              <Link href={searchParams.get("returnTo") || "/profile"}>
                <Button variant="outline">Отмена</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <EditProfileForm />
    </Suspense>
  )
}
