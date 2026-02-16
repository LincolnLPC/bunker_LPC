"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Flame, Users, Shield, Zap, Clock, Trophy, User, Lock, Award, Mic, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export default function LandingPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [gateCheck, setGateCheck] = useState<{ gateEnabled: boolean; unlocked: boolean } | null>(null)
  const [gatePassword, setGatePassword] = useState("")
  const [gateError, setGateError] = useState("")
  const [gateSubmitting, setGateSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/site-settings")
        if (!cancelled && res.ok) {
          const data = await res.json()
          setGateCheck({
            gateEnabled: data.gateEnabled ?? false,
            unlocked: data.unlocked ?? true,
          })
        } else if (!cancelled) {
          setGateCheck({ gateEnabled: false, unlocked: true })
        }
      } catch {
        if (!cancelled) setGateCheck({ gateEnabled: false, unlocked: true })
      }
    }
    fetchSettings()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const checkUser = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          setLoading(false)
          return
        }
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled) {
          setUser(user)
        }
      } catch (_) {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    checkUser()
    return () => { cancelled = true }
  }, [])

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGateError("")
    setGateSubmitting(true)
    try {
      const res = await fetch("/api/site-settings/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: gatePassword }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.reload()
      } else {
        setGateError(data.error || "Неверный пароль")
      }
    } catch {
      setGateError("Ошибка соединения")
    } finally {
      setGateSubmitting(false)
    }
  }

  // Gate: site under development — show form only if gate enabled AND not unlocked
  if (gateCheck?.gateEnabled && !gateCheck?.unlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('/apocalyptic-bunker-dark-texture.jpg')] opacity-10 bg-cover bg-center" />
        <div className="relative z-10 text-center max-w-md w-full">
          <Lock className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">Сайт в процессе разработки</h1>
          <p className="text-muted-foreground mb-8">Введите пароль для доступа</p>
          <form onSubmit={handleGateSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Пароль"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              className="text-center"
              autoFocus
              disabled={gateSubmitting}
            />
            {gateError && <p className="text-sm text-destructive">{gateError}</p>}
            <Button type="submit" className="w-full" disabled={gateSubmitting}>
              {gateSubmitting ? "Проверка…" : "Войти"}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Loading gate check
  if (gateCheck === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Flame className="h-12 w-12 text-primary animate-pulse" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('/apocalyptic-bunker-dark-texture.jpg')] opacity-10 bg-cover bg-center" />

        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Flame className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">БУНКЕР</span>
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-20 h-10" />
            ) : user ? (
              <>
                <Link href="/lobby">
                  <Button variant="ghost">Лобби</Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Профиль</span>
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost">Войти</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90">Регистрация</Button>
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-24 text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-balance">
            <span className="text-primary">БУНКЕР</span> ОНЛАЙН
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl text-pretty">
            Социальная игра на выживание. Докажи, что именно ты достоин места в бункере после катастрофы.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/lobby/create">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                Создать игру
              </Button>
            </Link>
            <Link href="/lobby/join">
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 border-primary/50 hover:bg-primary/10 bg-transparent"
              >
                Присоединиться
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Как играть</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Users className="h-10 w-10 text-primary" />}
              title="Собери команду"
              description="От 4 до 20 игроков. Каждый получает уникальную роль с профессией, навыками и секретами."
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10 text-primary" />}
              title="Раскрывай карты"
              description="Постепенно раскрывай свои характеристики, убеждая других в своей полезности для бункера."
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-primary" />}
              title="Голосуй и выживай"
              description="Каждый раунд голосуйте за исключение. Останься среди выживших до конца!"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-card/50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="10K+" label="Игроков" />
          <StatCard value="50K+" label="Игр сыграно" />
          <StatCard value="4.8" label="Рейтинг" />
          <StatCard value="24/7" label="Онлайн" />
        </div>
      </section>

      {/* Leaderboard Section */}
      <LeaderboardSection />

      {/* Game Modes */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Режимы игры</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <GameModeCard
              icon={<Clock className="h-8 w-8" />}
              title="Классический"
              description="Стандартные правила с 9 характеристиками. Идеально для новичков."
              duration="30-60 мин"
            />
            <GameModeCard
              icon={<Trophy className="h-8 w-8" />}
              title="Турнирный"
              description="Расширенные правила, дополнительные роли и специальные события."
              duration="60-90 мин"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-t from-orange-950/20 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Готов к выживанию?</h2>
          <p className="text-xl text-muted-foreground mb-8">Присоединяйся к тысячам игроков прямо сейчас</p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-12 py-6">
              Начать игру бесплатно
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <span className="font-bold">БУНКЕР ОНЛАЙН</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/support/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </Link>
              <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">
                Поддержка
              </Link>
            </div>
          </div>
          <p className="text-center md:text-left text-sm text-muted-foreground">© 2026 Бункер Онлайн. Все права защищены.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-xl bg-card/50 border border-border/50">
      <div className="mb-4 p-3 rounded-full bg-primary/10">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-primary">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  )
}

function GameModeCard({
  icon,
  title,
  description,
  duration,
}: { icon: React.ReactNode; title: string; description: string; duration: string }) {
  return (
    <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h3 className="text-2xl font-bold">{title}</h3>
      </div>
      <p className="text-muted-foreground mb-4">{description}</p>
      <div className="text-sm text-primary">{duration}</div>
    </div>
  )
}

interface LeaderboardEntry {
  rank: number
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  rating: number
  host_rating: number
  games_played: number
  games_won: number
  achievements_count: number
}

function LeaderboardSection() {
  const [list, setList] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/leaderboard?limit=20")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.leaderboard) setList(data.leaderboard)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Рейтинг игроков</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Лучшие игроки по рейтингу. Нажмите на игрока, чтобы открыть профиль.
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Пока никого нет в рейтинге. Сыграйте игры!</p>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium">Игрок</th>
                    <th className="text-right py-3 px-4 font-medium">Рейтинг</th>
                    <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Ведущий</th>
                    <th className="text-right py-3 px-4 font-medium">Игр</th>
                    <th className="text-right py-3 px-4 font-medium">Побед</th>
                    <th className="text-right py-3 px-4 font-medium hidden md:table-cell">Достижения</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/profile/${entry.id}`}
                          className="flex items-center gap-2 hover:text-primary font-medium"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                            {(entry.display_name || entry.username)[0]}
                          </span>
                          {entry.display_name || entry.username}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-primary">{entry.rating}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground hidden sm:table-cell">{entry.host_rating}</td>
                      <td className="py-3 px-4 text-right">{entry.games_played}</td>
                      <td className="py-3 px-4 text-right">{entry.games_won}</td>
                      <td className="py-3 px-4 text-right hidden md:table-cell">{entry.achievements_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border/50 text-center">
              <Link href="/profile/leaderboard">
                <Button variant="outline" size="sm">Вся таблица лидеров</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
