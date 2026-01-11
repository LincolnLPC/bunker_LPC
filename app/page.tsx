"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Flame, Users, Shield, Zap, Clock, Trophy, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export default function LandingPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    checkUser()
  }, [])
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
