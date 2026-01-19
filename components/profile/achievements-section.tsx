"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Trophy,
  Medal,
  Award,
  Crown,
  PlayCircle,
  Users,
  Target,
  Settings,
  Shield,
  Star,
  Flame,
  Zap,
  LucideIcon,
} from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"

interface Achievement {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: string
  tier: "bronze" | "silver" | "gold" | "platinum"
  points: number
  requirementValue: number
  earned: boolean
  earnedAt: string | null
  progress: number
}

interface AchievementsStats {
  totalPoints: number
  earnedCount: number
  totalCount: number
  completionRate: number
}

const iconMap: Record<string, LucideIcon> = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  crown: Crown,
  "play-circle": PlayCircle,
  users: Users,
  target: Target,
  settings: Settings,
  shield: Shield,
  star: Star,
  flame: Flame,
  zap: Zap,
}

const tierColors: Record<string, { bg: string; border: string; text: string }> = {
  bronze: {
    bg: "bg-orange-950/20",
    border: "border-orange-700/50",
    text: "text-orange-600",
  },
  silver: {
    bg: "bg-gray-900/20",
    border: "border-gray-600/50",
    text: "text-gray-500",
  },
  gold: {
    bg: "bg-yellow-950/20",
    border: "border-yellow-600/50",
    text: "text-yellow-500",
  },
  platinum: {
    bg: "bg-purple-950/20",
    border: "border-purple-600/50",
    text: "text-purple-400",
  },
}

const categoryNames: Record<string, string> = {
  general: "Общие",
  games: "Игры",
  wins: "Победы",
  social: "Социальные",
  premium: "Премиум",
  special: "Особые",
}

export function AchievementsSection() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState<AchievementsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const { data, error } = await safeFetch<{
          achievements: Achievement[]
          stats: AchievementsStats
        }>("/api/achievements")

        if (error || !data) {
          console.error("Error loading achievements:", error)
          setLoading(false)
          return
        }

        setAchievements(data.achievements || [])
        setStats(data.stats || null)
      } catch (err) {
        console.error("Error fetching achievements:", err)
      } finally {
        setLoading(false)
      }
    }

    loadAchievements()
  }, [])

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Достижения</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Загрузка...</div>
        </CardContent>
      </Card>
    )
  }

  // Group achievements by category
  const grouped = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = []
    }
    acc[achievement.category].push(achievement)
    return acc
  }, {} as Record<string, Achievement[]>)

  // Get earned achievements first, then unearned
  const sortAchievements = (a: Achievement[], b: Achievement[]) => {
    const earnedA = a.filter((ach) => ach.earned).length
    const earnedB = b.filter((ach) => ach.earned).length
    if (earnedB !== earnedA) return earnedB - earnedA
    return a.length - b.length
  }

  const categoryOrder = ["general", "games", "wins", "social", "premium", "special"]

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Достижения
            </CardTitle>
            <CardDescription>
              {stats ? (
                <>
                  {stats.earnedCount} из {stats.totalCount} ({stats.completionRate}%) • {stats.totalPoints} очков
                </>
              ) : (
                "Отслеживайте свой прогресс"
              )}
            </CardDescription>
          </div>
          {stats && (
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {stats.totalPoints}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {categoryOrder.map((category) => {
          const categoryAchievements = grouped[category] || []
          if (categoryAchievements.length === 0) return null

          // Sort: earned first, then by points descending
          const sorted = [...categoryAchievements].sort((a, b) => {
            if (a.earned !== b.earned) return a.earned ? -1 : 1
            return b.points - a.points
          })

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {categoryNames[category] || category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sorted.map((achievement) => {
                  const IconComponent = iconMap[achievement.icon] || Trophy
                  const tierColor = tierColors[achievement.tier] || tierColors.bronze
                  const isEarned = achievement.earned

                  return (
                    <div
                      key={achievement.id}
                      className={`relative p-3 rounded-lg border transition-all ${
                        isEarned
                          ? `${tierColor.bg} ${tierColor.border} border-2`
                          : "bg-muted/30 border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-md ${
                            isEarned ? tierColor.bg : "bg-muted"
                          }`}
                        >
                          <IconComponent
                            className={`w-5 h-5 ${isEarned ? tierColor.text : "text-muted-foreground"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4
                                className={`font-semibold text-sm ${
                                  isEarned ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {achievement.name}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-0.5">{achievement.description}</p>
                            </div>
                            <Badge
                              variant={isEarned ? "default" : "secondary"}
                              className={`text-xs ${isEarned ? tierColor.bg : ""}`}
                            >
                              {achievement.points}
                            </Badge>
                          </div>
                          {!isEarned && achievement.progress > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Прогресс</span>
                                <span>{achievement.progress}%</span>
                              </div>
                              <Progress value={achievement.progress} className="h-1.5" />
                            </div>
                          )}
                          {isEarned && achievement.earnedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Получено: {new Date(achievement.earnedAt).toLocaleDateString("ru-RU")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
