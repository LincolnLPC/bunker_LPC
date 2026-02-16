"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Flame, Plus, Users, LogOut, User, Settings, HelpCircle, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export default function LobbyPage() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
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

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">БУНКЕР</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/support/faq">
            <Button variant="ghost" size="sm" className="hidden sm:flex" title="FAQ">
              <HelpCircle className="h-4 w-4 mr-2" />
              FAQ
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.user_metadata?.username || user?.email?.split("@")[0]}</span>
            </Button>
          </Link>
          <Link href="/messages">
            <Button variant="ghost" size="icon" title="Сообщения">
              <MessageSquare className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="ghost" size="icon" title="Профиль">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Выйти">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Лобби</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Link href="/lobby/create">
            <Card className="h-full bg-card/50 border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Создать игру</CardTitle>
                <CardDescription>Создайте новую комнату и пригласите друзей</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/lobby/join">
            <Card className="h-full bg-card/50 border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Присоединиться</CardTitle>
                <CardDescription>Введите код комнаты для присоединения к игре</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/lobby/rooms">
            <Card className="h-full bg-card/50 border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Flame className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Список комнат</CardTitle>
                <CardDescription>Просмотр активных комнат и быстрое присоединение</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Recent Games */}
        <section>
          <h2 className="text-xl font-bold mb-4">Недавние игры</h2>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">У вас пока нет завершенных игр</CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
