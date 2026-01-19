"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Flame, Loader2 } from "lucide-react"
import { validateRoomCode } from "@/lib/security/validation"
import { safeFetch } from "@/lib/api/safe-fetch"

export default function JoinGamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [roomCode, setRoomCode] = useState("")
  const [roomPassword, setRoomPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresPassword, setRequiresPassword] = useState(false)

  // Auto-fill room code from URL parameter
  useEffect(() => {
    // Extract code immediately to avoid serialization issues with searchParams object
    try {
      const codeParam = searchParams.get("code")
      if (codeParam) {
        // Clean and normalize the code
        const cleaned = codeParam.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6)
        setRoomCode(cleaned)
      }
    } catch (e) {
      // Ignore errors from searchParams serialization in DevTools
      console.debug("[JoinPage] Could not read searchParams (DevTools serialization issue)")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount to avoid dependency on searchParams object

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Clean the room code: remove invalid characters, take first 6 characters, uppercase
    const cleanedCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6)

    if (!cleanedCode) {
      setError("Введите код комнаты")
      setLoading(false)
      return
    }

    // Validate room code format on client side
    const validation = validateRoomCode(cleanedCode)
    if (!validation.valid) {
      setError(validation.errors.join(". ") || "Неверный формат кода комнаты")
      setLoading(false)
      return
    }

    try {
      console.log("[JoinPage] Attempting to join room:", cleanedCode)
      
      const result = await safeFetch<{ player: any; roomId: string; isExisting?: boolean; isSpectator?: boolean; spectatorId?: string; requiresPassword?: boolean; wasPlayer?: boolean; error?: string }>("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: cleanedCode, password: roomPassword.trim() || undefined }),
      })

      if (!result.success || result.error) {
        console.error("[JoinPage] Join error:", result.error, result)
        
        // Check if password is required - check both error message and response data
        const errorMessage = (result.error || "").toLowerCase()
        const responseData = result.data as any
        
        if (result.status === 403 && (responseData?.requiresPassword || errorMessage.includes("паролем"))) {
          setRequiresPassword(true)
          setError(result.error || "Эта комната защищена паролем")
          setLoading(false)
          return
        }
        
        // If user is already in room, redirect anyway (they can continue playing)
        if (errorMessage.includes("already") || errorMessage.includes("уже") || result.status === 409 || result.status === 200) {
          console.log("[JoinPage] User already in room, redirecting anyway:", cleanedCode)
          router.push(`/game/${cleanedCode}`)
          return
        }
        
        throw new Error(result.error || "Не удалось присоединиться к игре")
      }

      const data = result.data

      // Check if user joined as player, spectator, or is already in room
      if (data && (data.isExisting || data.player || data.isSpectator)) {
        console.log("[JoinPage] Successfully joined, redirecting:", cleanedCode, {
          isExisting: data.isExisting,
          isSpectator: data.isSpectator,
          playerId: data.player?.id,
          spectatorId: data.spectatorId,
          characteristicsCount: data.characteristicsCount
        })
        router.push(`/game/${cleanedCode}`)
        return
      }

      // If we get here, something is wrong
      console.error("[JoinPage] No player or spectator in response:", data)
      throw new Error("Не удалось присоединиться к игре (нет данных об игроке или зрителе)")
    } catch (err) {
      console.error("[JoinPage] Error joining room:", err)
      setError(err instanceof Error ? err.message : "Не удалось присоединиться к игре")
      setLoading(false)
    }
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
          <span className="text-xl font-bold">Присоединиться к игре</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-md mx-auto px-6 py-12">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Код комнаты</CardTitle>
            <CardDescription>Введите код, который вам дал создатель игры</CardDescription>
          </CardHeader>
          <form onSubmit={handleJoin}>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="code">Код комнаты</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="ABCD12"
                  value={roomCode}
                  onChange={(e) => {
                    // Only allow alphanumeric characters, uppercase, max 6 chars
                    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6)
                    setRoomCode(cleaned)
                    setError(null) // Clear error when user types
                    setRequiresPassword(false) // Reset password requirement when code changes
                  }}
                  className="bg-background/50 text-center text-2xl font-bold tracking-widest uppercase"
                  maxLength={6}
                  pattern="[A-Z0-9]{6}"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <p className="text-xs text-muted-foreground text-center">
                  6 символов (буквы и цифры)
                </p>
              </div>

              {requiresPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль комнаты</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите пароль..."
                    value={roomPassword}
                    onChange={(e) => {
                      setRoomPassword(e.target.value)
                      setError(null) // Clear error when user types
                    }}
                    className="bg-background/50"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Эта комната защищена паролем
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Подключение...
                  </>
                ) : (
                  "Присоединиться"
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </main>
    </div>
  )
}
