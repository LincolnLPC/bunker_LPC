"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Flame, Loader2, Crown, Users, AlertTriangle, Home, Copy, Check, ChevronDown, ChevronUp, Settings2, Eye, EyeOff } from "lucide-react"
import { SAMPLE_CATASTROPHES, SAMPLE_BUNKERS } from "@/types/game"
import { CHARACTERISTICS_BY_CATEGORY, PROFESSIONS, HEALTH_CONDITIONS, HOBBIES, PHOBIAS, BAGGAGE, FACTS, SPECIAL, BIO, SKILLS, TRAITS } from "@/lib/game/characteristics"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export default function CreateGamePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState<8 | 12 | 16 | 20>(12)
  const [roundTimer, setRoundTimer] = useState(120)
  const [autoReveal, setAutoReveal] = useState(false)
  const [spectators, setSpectators] = useState(true)
  const [hostRole, setHostRole] = useState<"host_and_player" | "host_only">("host_and_player")
  const [roundMode, setRoundMode] = useState<"manual" | "automatic">("automatic")
  const [discussionTime, setDiscussionTime] = useState(120) // Время на обсуждение (секунды)
  const [votingTime, setVotingTime] = useState(60) // Время на голосование (секунды)
  const [selectedCatastrophe, setSelectedCatastrophe] = useState<string>("")
  const [selectedBunker, setSelectedBunker] = useState<string>("")
  const [customCatastrophe, setCustomCatastrophe] = useState("")
  const [customBunker, setCustomBunker] = useState("")
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const [excludeNonBinaryGender, setExcludeNonBinaryGender] = useState(false)
  const [roomPassword, setRoomPassword] = useState("")
  const [isRoomHidden, setIsRoomHidden] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Characteristics settings
  const [showCharacteristicsSettings, setShowCharacteristicsSettings] = useState(false)
  const [characteristicsEnabled, setCharacteristicsEnabled] = useState<Record<string, boolean>>({
    gender: true,
    age: true,
    profession: true,
    health: true,
    hobby: true,
    phobia: true,
    baggage: true,
    fact: true,
    special: true,
    bio: true,
    skill: true,
    trait: true,
    additional: true,
  })
  const [customCharacteristics, setCustomCharacteristics] = useState<Record<string, string>>({
    gender: "",
    age: "",
    profession: "",
    health: "",
    hobby: "",
    phobia: "",
    baggage: "",
    fact: "",
    special: "",
    bio: "",
    skill: "",
    trait: "",
    additional: "",
  })

  const categoryLabels: Record<string, string> = {
    gender: "Пол",
    age: "Возраст",
    profession: "Профессия",
    health: "Здоровье",
    hobby: "Хобби",
    phobia: "Фобия",
    baggage: "Багаж",
    fact: "Факт",
    special: "Особенность",
    bio: "Биология",
    skill: "Навык",
    trait: "Характер",
    additional: "Дополнительно",
  }

  const defaultCharacteristics: Record<string, readonly string[]> = {
    gender: ["М", "Ж", "А"],
    age: [], // Возраст генерируется случайно
    profession: PROFESSIONS,
    health: HEALTH_CONDITIONS,
    hobby: HOBBIES,
    phobia: PHOBIAS,
    baggage: BAGGAGE,
    fact: FACTS,
    special: SPECIAL,
    bio: BIO,
    skill: SKILLS,
    trait: TRAITS,
    additional: [],
  }

  const handleCreate = async () => {
    setLoading(true)

    try {
      // Determine catastrophe and bunker
      // If nothing is selected, choose random
      let catastrophe = customCatastrophe.trim()
      let bunkerDescription = customBunker.trim()
      
      if (!catastrophe) {
        if (selectedCatastrophe === "random" || !selectedCatastrophe || selectedCatastrophe === "") {
          catastrophe = SAMPLE_CATASTROPHES[Math.floor(Math.random() * SAMPLE_CATASTROPHES.length)]
        } else if (selectedCatastrophe && selectedCatastrophe !== "custom") {
          catastrophe = selectedCatastrophe
        } else {
          // If custom is selected but no custom text, choose random
          catastrophe = SAMPLE_CATASTROPHES[Math.floor(Math.random() * SAMPLE_CATASTROPHES.length)]
        }
      }
      
      if (!bunkerDescription) {
        if (selectedBunker === "random" || !selectedBunker || selectedBunker === "") {
          bunkerDescription = SAMPLE_BUNKERS[Math.floor(Math.random() * SAMPLE_BUNKERS.length)]
        } else if (selectedBunker && selectedBunker !== "custom") {
          bunkerDescription = selectedBunker
        } else {
          // If custom is selected but no custom text, choose random
          bunkerDescription = SAMPLE_BUNKERS[Math.floor(Math.random() * SAMPLE_BUNKERS.length)]
        }
      }

      // Prepare characteristics settings
      const characteristicsSettings: Record<string, { enabled: boolean; customList?: string[] }> = {}
      Object.keys(characteristicsEnabled).forEach((category) => {
        const enabled = characteristicsEnabled[category]
        let customList = customCharacteristics[category]?.trim()
        
        // Для категории "пол": убрать модификаторы (с) и (а) из кастомного списка
        if (category === "gender" && customList) {
          customList = customList
            .replace(/\(с\)/g, "")
            .replace(/\(а\)/g, "")
            .replace(/\s+/g, " ")
            .trim()
        }
        
        const customValues = customList
          ? customList.split(",").map((v) => v.trim()).filter((v) => v.length > 0)
          : undefined

        characteristicsSettings[category] = {
          enabled,
          ...(customValues && customValues.length > 0 ? { customList: customValues } : {}),
        }
      })

      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPlayers,
          roundTimerSeconds: roundTimer,
          catastrophe,
          bunkerDescription,
          password: roomPassword.trim() || null, // Send password if provided
          isHidden: isRoomHidden, // Send is_hidden flag
          settings: {
            autoReveal,
            spectators,
            hostRole, // "host_and_player" or "host_only"
            excludeNonBinaryGender, // Исключить пол "А" из опций
            characteristics: characteristicsSettings,
            roundMode, // "manual" or "automatic"
            discussionTime, // Время на обсуждение (только для автоматического режима)
            votingTime, // Время на голосование (только для автоматического режима)
          },
        }),
      })

      // Read response as text first (can only read once)
      const contentType = response.headers.get("content-type")
      const text = await response.text()
      
      if (!text || !text.trim()) {
        throw new Error(`Empty response from server: ${response.status} ${response.statusText}`)
      }

      // Parse JSON from text
      let responseData: any
      try {
        responseData = JSON.parse(text)
      } catch (parseError) {
        console.error("Failed to parse response:", parseError, "Response text:", text.substring(0, 200))
        throw new Error(`Invalid JSON response from server: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        // Handle error responses
        const data = responseData || {}
        
        if (data.requiresUpgrade) {
          setRequiresUpgrade(true)
          setError(data.error || data.message || "Требуется обновление подписки")
          setLoading(false)
          return
        }
        
        throw new Error(data.error || data.message || `Server error: ${response.status} ${response.statusText}`)
      }

      // Handle successful response
      if (!responseData || typeof responseData !== "object") {
        throw new Error("Invalid response data format")
      }

      const { room } = responseData
      if (!room) {
        console.error("Room data not found in response:", responseData)
        throw new Error("Room data not found in response")
      }
      setCreatedRoomCode(room.room_code)
      
      // Auto-redirect after showing invite link for 3 seconds
      setTimeout(() => {
        router.push(`/game/${room.room_code}`)
      }, 3000)
    } catch (error) {
      console.error("Error creating room:", error)
      setError(error instanceof Error ? error.message : "Не удалось создать комнату")
      setLoading(false)
    }
  }

  const handleCopyInviteLink = () => {
    if (!createdRoomCode) return
    const inviteLink = `${window.location.origin}/lobby/join?code=${createdRoomCode}`
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true)
      setTimeout(() => setInviteLinkCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/lobby">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Создание игры</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Настройки комнаты</CardTitle>
            <CardDescription>Настройте параметры игры перед началом</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Error Message */}
            {error && (
              <div className={`p-4 rounded-lg border ${requiresUpgrade ? "bg-primary/10 border-primary/50" : "bg-destructive/10 border-destructive/50"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${requiresUpgrade ? "text-primary" : "text-destructive"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${requiresUpgrade ? "text-primary" : "text-destructive"}`}>
                      {error}
                    </p>
                    {requiresUpgrade && (
                      <div className="mt-3">
                        <Link href="/subscription">
                          <Button size="sm" className="bg-primary hover:bg-primary/90">
                            <Crown className="w-4 h-4 mr-2" />
                            Обновить до Премиум
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Max Players */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Количество игроков</Label>
                {maxPlayers > 12 && (
                  <Badge variant="outline" className="text-primary border-primary/50">
                    <Crown className="w-3 h-3 mr-1" />
                    Премиум
                  </Badge>
                )}
              </div>
              <Select
                value={maxPlayers.toString()}
                onValueChange={(v) => setMaxPlayers(Number.parseInt(v) as 8 | 12 | 16 | 20)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 игроков</SelectItem>
                  <SelectItem value="12">12 игроков (Базовый тариф)</SelectItem>
                  <SelectItem value="16">
                    <div className="flex items-center gap-2">
                      16 игроков
                      <Crown className="w-3 h-3 text-primary" />
                    </div>
                  </SelectItem>
                  <SelectItem value="20">
                    <div className="flex items-center gap-2">
                      20 игроков
                      <Crown className="w-3 h-3 text-primary" />
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {maxPlayers > 12 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Комнаты на более чем 12 игроков доступны только с Премиум подпиской
                </p>
              )}
            </div>

            {/* Round Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Режим переключения раундов</Label>
              </div>
              <RadioGroup value={roundMode} onValueChange={(v) => setRoundMode(v as "manual" | "automatic")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="round-mode-manual" />
                  <Label htmlFor="round-mode-manual" className="font-normal cursor-pointer">
                    Ручное переключение
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Ведущий сам переключает раунды и запускает голосование без таймеров
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="automatic" id="round-mode-automatic" />
                  <Label htmlFor="round-mode-automatic" className="font-normal cursor-pointer">
                    Автоматическое переключение
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Таймер автоматически переключает раунды и запускает голосование
                </p>
              </RadioGroup>
            </div>

            {/* Timer Settings - Only show for automatic mode */}
            {roundMode === "automatic" && (
              <>
                {/* Discussion Time */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Время на обсуждение</Label>
                    <span className="text-sm text-muted-foreground">{discussionTime} сек</span>
                  </div>
                  <Slider
                    value={[discussionTime]}
                    onValueChange={([v]) => setDiscussionTime(v)}
                    min={60}
                    max={600}
                    step={30}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Время на обсуждение перед началом голосования
                  </p>
                </div>

                {/* Voting Time */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Время на голосование</Label>
                    <span className="text-sm text-muted-foreground">{votingTime} сек</span>
                  </div>
                  <Slider
                    value={[votingTime]}
                    onValueChange={([v]) => setVotingTime(v)}
                    min={30}
                    max={300}
                    step={15}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Время на голосование перед переходом к следующему раунду
                  </p>
                </div>
              </>
            )}

            {/* Auto Reveal */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Авто-раскрытие карт</Label>
                <p className="text-sm text-muted-foreground">Автоматически раскрывать одну карту в раунд</p>
              </div>
              <Switch checked={autoReveal} onCheckedChange={setAutoReveal} />
            </div>

            {/* Spectators */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Зрители</Label>
                <p className="text-sm text-muted-foreground">Разрешить зрителям наблюдать за игрой</p>
              </div>
              <Switch checked={spectators} onCheckedChange={setSpectators} />
            </div>

            {/* Exclude Non-Binary Gender */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Исключить пол "А"</Label>
                <p className="text-sm text-muted-foreground">Не использовать небинарный пол при генерации игроков</p>
              </div>
              <Switch checked={excludeNonBinaryGender} onCheckedChange={setExcludeNonBinaryGender} />
            </div>

            {/* Room Password */}
            <div className="space-y-3">
              <Label>Пароль на комнату (необязательно)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль для защиты комнаты..."
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="bg-background/50 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Если установлен пароль, игроки должны будут ввести его для присоединения
              </p>
            </div>

            {/* Hide Room */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Скрыть комнату</Label>
                <p className="text-sm text-muted-foreground">Комната не будет отображаться в списке комнат</p>
              </div>
              <Switch checked={isRoomHidden} onCheckedChange={setIsRoomHidden} />
            </div>

            {/* Catastrophe Selection */}
            <div className="space-y-3">
              <Label>Катастрофа</Label>
              <Select value={selectedCatastrophe} onValueChange={setSelectedCatastrophe}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Выберите катастрофу или создайте свою" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">🎲 Случайная катастрофа</SelectItem>
                  {SAMPLE_CATASTROPHES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Своя катастрофа...</SelectItem>
                </SelectContent>
              </Select>
              {selectedCatastrophe === "custom" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Опишите свою катастрофу..."
                    value={customCatastrophe}
                    onChange={(e) => setCustomCatastrophe(e.target.value)}
                    className="min-h-[80px] bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Например: "Солнечная вспышка", "Нашествие насекомых", "Глобальное наводнение"
                  </p>
                </div>
              )}
              {selectedCatastrophe && selectedCatastrophe !== "custom" && selectedCatastrophe !== "random" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{selectedCatastrophe}</p>
                </div>
              )}
              {selectedCatastrophe === "random" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">🎲 Катастрофа будет выбрана случайным образом при создании игры</p>
                </div>
              )}
            </div>

            {/* Bunker Selection */}
            <div className="space-y-3">
              <Label>Описание бункера</Label>
              <Select value={selectedBunker} onValueChange={setSelectedBunker}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Выберите бункер или создайте свой" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">🎲 Случайный бункер</SelectItem>
                  {SAMPLE_BUNKERS.map((bunker, index) => (
                    <SelectItem key={index} value={bunker}>
                      {bunker.length > 60 ? `${bunker.substring(0, 60)}...` : bunker}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Свой бункер...</SelectItem>
                </SelectContent>
              </Select>
              {selectedBunker === "custom" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Опишите свой бункер..."
                    value={customBunker}
                    onChange={(e) => setCustomBunker(e.target.value)}
                    className="min-h-[100px] bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Укажите площадь, срок работы, особенности и запасы
                  </p>
                </div>
              )}
              {selectedBunker && selectedBunker !== "custom" && selectedBunker !== "random" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Home className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{selectedBunker}</p>
                </div>
              )}
              {selectedBunker === "random" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Home className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">🎲 Бункер будет выбран случайным образом при создании игры</p>
                </div>
              )}
            </div>

            {/* Host Role */}
            <div className="space-y-3">
              <Label>Роль ведущего</Label>
              <RadioGroup value={hostRole} onValueChange={(value) => setHostRole(value as "host_and_player" | "host_only")}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 bg-background/50">
                  <RadioGroupItem value="host_and_player" id="host_and_player" />
                  <label
                    htmlFor="host_and_player"
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">Ведущий и Игрок</div>
                      <p className="text-xs text-muted-foreground">
                        Ведущий отображается в игре как обычный игрок с правами управления
                      </p>
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 bg-background/50">
                  <RadioGroupItem value="host_only" id="host_only" />
                  <label
                    htmlFor="host_only"
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <Crown className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">Только Ведущий</div>
                      <p className="text-xs text-muted-foreground">
                        Ведущий не отображается в списке игроков, только управляет игрой
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Characteristics Settings */}
            <Collapsible open={showCharacteristicsSettings} onOpenChange={setShowCharacteristicsSettings}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    <span>Настройки характеристик</span>
                  </div>
                  {showCharacteristicsSettings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                <div className="p-4 rounded-lg border border-border/50 bg-background/50 space-y-4 max-h-[600px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">
                    Настройте какие характеристики будут использоваться в игре. Можно включать/отключать категории и задавать свой список через запятую.
                  </p>
                  
                  {Object.keys(categoryLabels).map((category) => {
                    const defaultList = defaultCharacteristics[category] || []
                    const enabled = characteristicsEnabled[category] ?? true
                    const customValue = customCharacteristics[category] || ""

                    return (
                      <div key={category} className="space-y-2 p-3 rounded-lg border border-border/30 bg-background/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) =>
                                setCharacteristicsEnabled((prev) => ({ ...prev, [category]: checked }))
                              }
                            />
                            <Label className="font-medium">{categoryLabels[category]}</Label>
                          </div>
                          {defaultList.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {defaultList.length} по умолчанию
                            </Badge>
                          )}
                        </div>
                        
                        {enabled && (
                          <div className="space-y-2 ml-9">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Кастомный список (через запятую). Если пусто, используются значения по умолчанию.
                              </Label>
                              <Textarea
                                placeholder={
                                  category === "age"
                                    ? "Возраст генерируется автоматически (18-80 лет)"
                                    : category === "gender"
                                      ? "Например: М, Ж, А (модификаторы (с) и (а) будут автоматически удалены)"
                                      : defaultList.length > 0
                                        ? `Например: ${defaultList.slice(0, 3).join(", ")}, ...`
                                        : "Введите значения через запятую"
                                }
                                value={customValue}
                                onChange={(e) => {
                                  let value = e.target.value
                                  // Для категории "пол": автоматически удалять модификаторы (с) и (а)
                                  if (category === "gender") {
                                    value = value
                                      .replace(/\(с\)/g, "")
                                      .replace(/\(а\)/g, "")
                                      .replace(/\s+/g, " ")
                                  }
                                  setCustomCharacteristics((prev) => ({ ...prev, [category]: value }))
                                }}
                                className="min-h-[60px] text-sm bg-background/50"
                                disabled={category === "age"}
                              />
                              {customValue && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Будет использовано: {customValue.split(",").map(v => v.trim()).filter(v => v).length} значений
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button onClick={handleCreate} className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать комнату"
              )}
            </Button>

            {/* Invite Link Modal */}
            {createdRoomCode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Card className="w-full max-w-md mx-4 bg-card border-2 border-primary">
                  <CardHeader>
                    <CardTitle className="text-center">Комната создана!</CardTitle>
                    <CardDescription className="text-center">
                      Пригласите друзей присоединиться к игре
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Код комнаты</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-4 py-3 rounded-lg bg-muted font-mono text-xl text-center font-bold">
                          {createdRoomCode}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyInviteLink}
                          className="flex-shrink-0"
                        >
                          {inviteLinkCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Пригласительная ссылка</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${typeof window !== "undefined" ? window.location.origin : ""}/lobby/join?code=${createdRoomCode}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm border border-border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyInviteLink}
                          className="flex-shrink-0"
                        >
                          {inviteLinkCopied ? (
                            <>
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              Скопировано
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Копировать
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="pt-2 text-center text-sm text-muted-foreground">
                      Перенаправление в комнату через 3 секунды...
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
