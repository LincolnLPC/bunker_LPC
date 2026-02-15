"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Flame, ArrowLeft, AlertTriangle, Shield, Ban, Loader2, AlertCircle, Plus, Check, X, Eye, Trash2, Gamepad2, Crown, MessageSquare, Users, ExternalLink, Lock, Settings2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { CreateBanModal } from "@/components/admin/create-ban-modal"
import { GrantPremiumModal } from "@/components/admin/grant-premium-modal"
import { safeFetch } from "@/lib/api/safe-fetch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface Report {
  id: string
  reporter_id: string
  reported_user_id: string
  room_id: string | null
  report_type: string
  description: string
  status: string
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  reporter_name: string | null
  reported_user_name: string | null
}

interface Ban {
  id: string
  user_id: string
  banned_by: string
  reason: string
  ban_type: string
  expires_at: string | null
  is_active: boolean
  created_at: string
  user_name: string | null
  banned_by_name: string | null
}

interface GameRoom {
  id: string
  room_code: string
  host_id: string
  host_name: string
  max_players: number
  phase: string
  current_round: number
  player_count: number
  active_player_count: number
  real_player_count?: number
  is_empty?: boolean
  catastrophe: string
  bunker_description: string
  created_at: string
  updated_at: string
}

interface AdminUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  subscription_tier: string
  premium_expires_at: string | null
  created_at: string
  updated_at?: string
  games_played: number
  games_won: number
  email?: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [bans, setBans] = useState<Ban[]>([])
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingBans, setLoadingBans] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [cleaningRooms, setCleaningRooms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [selectedReportForBan, setSelectedReportForBan] = useState<Report | null>(null)
  const [selectedReportForStatus, setSelectedReportForStatus] = useState<Report | null>(null)
  const [statusUpdateNotes, setStatusUpdateNotes] = useState("")
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [premiumUsers, setPremiumUsers] = useState<any[]>([])
  const [loadingPremiumUsers, setLoadingPremiumUsers] = useState(false)
  const [selectedPremiumUser, setSelectedPremiumUser] = useState<any | null>(null)
  const [revokingPremium, setRevokingPremium] = useState(false)
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [ticketResponse, setTicketResponse] = useState("")
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [siteSettings, setSiteSettings] = useState<{ gateEnabled: boolean; productionMode: boolean; hasPassword: boolean } | null>(null)
  const [siteSettingsPassword, setSiteSettingsPassword] = useState("")
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false)
  const [siteSettingsError, setSiteSettingsError] = useState<string | null>(null)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user)

      // Check if user is admin
      const { data: adminRole, error: adminError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()

      // Debug logging
      console.log("[Admin Check] User ID:", user.id)
      console.log("[Admin Check] Admin Role Data:", adminRole)
      console.log("[Admin Check] Admin Error:", adminError)

      if (adminError || !adminRole) {
        // More detailed error message
        const errorMessage = adminError
          ? `Ошибка проверки доступа: ${adminError.message}. Код: ${adminError.code || "unknown"}`
          : "Запись админа не найдена в базе данных"
        setError(`У вас нет доступа к админ-панели. ${errorMessage}`)
        setIsAdmin(false)
      } else {
        setIsAdmin(true)
        loadReports()
        loadBans()
        loadRooms()
        loadPremiumUsers()
        loadSupportTickets()
        loadUsers()
        loadSiteSettings()
      }

      setLoading(false)
    }

    checkAdmin()
  }, [router])

  const loadReports = async () => {
    const supabase = createClient()
    setLoadingReports(true)

    try {
      // Fetch reports with user names
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select(
          `
          *,
          reporter:profiles!reports_reporter_id_fkey(display_name, username),
          reported_user:profiles!reports_reported_user_id_fkey(display_name, username)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100)

      if (reportsError) throw reportsError

      const formattedReports: Report[] =
        reportsData?.map((r: any) => ({
          ...r,
          reporter_name: r.reporter?.display_name || r.reporter?.username || "Неизвестно",
          reported_user_name:
            r.reported_user?.display_name || r.reported_user?.username || "Неизвестно",
        })) || []

      setReports(formattedReports)
    } catch (err) {
      console.error("Error loading reports:", err)
      setError("Не удалось загрузить жалобы")
    } finally {
      setLoadingReports(false)
    }
  }

  const loadBans = async () => {
    const supabase = createClient()
    setLoadingBans(true)

    try {
      // Fetch bans with user names
      const { data: bansData, error: bansError } = await supabase
        .from("bans")
        .select(
          `
          *,
          user:profiles!bans_user_id_fkey(display_name, username),
          banned_by_user:profiles!bans_banned_by_fkey(display_name, username)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100)

      if (bansError) throw bansError

      const formattedBans: Ban[] =
        bansData?.map((b: any) => ({
          ...b,
          user_name: b.user?.display_name || b.user?.username || "Неизвестно",
          banned_by_name: b.banned_by_user?.display_name || b.banned_by_user?.username || "Неизвестно",
        })) || []

      setBans(formattedBans)
    } catch (err) {
      console.error("Error loading bans:", err)
      setError("Не удалось загрузить баны")
    } finally {
      setLoadingBans(false)
    }
  }

  const loadRooms = async () => {
    setLoadingRooms(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; rooms: GameRoom[] }>(
        "/api/admin/rooms",
        {
          method: "GET",
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось загрузить комнаты")
        return
      }

      if (data?.success && data.rooms) {
        setRooms(data.rooms)
      }
    } catch (err) {
      console.error("Error loading rooms:", err)
      setError("Произошла ошибка при загрузке комнат")
    } finally {
      setLoadingRooms(false)
    }
  }

  const handleDeleteRoom = async (roomId: string, roomCode: string) => {
    if (!confirm(`Вы уверены, что хотите удалить комнату ${roomCode}? Это действие нельзя отменить.`)) {
      return
    }

    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; message: string }>(
        `/api/admin/rooms?roomId=${roomId}`,
        {
          method: "DELETE",
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось удалить комнату")
        return
      }

      if (data?.success) {
        // Reload rooms
        loadRooms()
      }
    } catch (err) {
      console.error("Error deleting room:", err)
      setError("Произошла ошибка при удалении комнаты")
    }
  }

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      waiting: "Ожидание",
      playing: "Игра",
      voting: "Голосование",
      results: "Результаты",
      finished: "Завершена",
    }
    return labels[phase] || phase
  }

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case "waiting":
        return "secondary"
      case "playing":
        return "default"
      case "voting":
        return "default"
      case "results":
        return "outline"
      case "finished":
        return "outline"
      default:
        return "ghost"
    }
  }

  const handleCleanupRooms = async () => {
    if (!confirm("Запустить автоматическую очистку пустых комнат? Это удалит все комнаты без игроков.")) {
      return
    }

    setCleaningRooms(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; deletedCount: number; message: string }>(
        "/api/game/cleanup",
        {
          method: "POST",
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось выполнить очистку")
        return
      }

      if (data?.success) {
        // Reload rooms
        loadRooms()
        alert(`Очистка завершена. Удалено комнат: ${data.deletedCount || 0}`)
      }
    } catch (err) {
      console.error("Error cleaning up rooms:", err)
      setError("Произошла ошибка при очистке комнат")
    } finally {
      setCleaningRooms(false)
    }
  }

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cheating: "Читерство",
      harassment: "Оскорбления",
      spam: "Спам",
      inappropriate_content: "Неуместный контент",
      other: "Другое",
    }
    return labels[type] || type
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "reviewing":
        return "default"
      case "resolved":
        return "outline"
      case "dismissed":
        return "outline"
      default:
        return "ghost"
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Ожидает",
      reviewing: "Рассматривается",
      resolved: "Решено",
      dismissed: "Отклонено",
    }
    return labels[status] || status
  }

  const handleCreateBan = (report: Report) => {
    setSelectedReportForBan(report)
    setShowBanModal(true)
  }

  const handleBanSuccess = () => {
    setShowBanModal(false)
    setSelectedReportForBan(null)
    loadReports()
    loadBans()
  }

  const loadPremiumUsers = async () => {
    setLoadingPremiumUsers(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; users: any[] }>(
        "/api/admin/premium-users",
        {
          method: "GET",
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось загрузить премиум пользователей")
        return
      }

      if (data?.success && data.users) {
        // Check if premium is expired
        const usersWithExpiration = data.users.map((user) => ({
          ...user,
          isExpired: user.premium_expires_at
            ? new Date(user.premium_expires_at) < new Date()
            : false,
        }))
        setPremiumUsers(usersWithExpiration)
      }
    } catch (err) {
      console.error("Error loading premium users:", err)
      setError("Произошла ошибка при загрузке премиум пользователей")
    } finally {
      setLoadingPremiumUsers(false)
    }
  }

  const handleRevokePremium = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите отменить премиум подписку у этого пользователя?")) {
      return
    }

    setRevokingPremium(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; message: string }>(
        "/api/admin/revoke-premium",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось отменить премиум подписку")
        return
      }

      if (data?.success) {
        setSelectedPremiumUser(null)
        loadPremiumUsers()
        alert("Премиум подписка успешно отменена")
      } else {
        setError("Не удалось отменить премиум подписку")
      }
    } catch (err) {
      console.error("Error revoking premium:", err)
      setError("Произошла ошибка при отмене премиум подписки")
    } finally {
      setRevokingPremium(false)
    }
  }

  const loadSupportTickets = async () => {
    setLoadingSupportTickets(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{
        success: boolean
        tickets: any[]
        total: number
      }>("/api/admin/support-tickets", {
        method: "GET",
      })

      if (fetchError) {
        console.error("[Admin] Error loading support tickets:", fetchError)
        setError(fetchError.message || "Не удалось загрузить тикеты поддержки")
        setSupportTickets([])
        return
      }

      if (data?.success) {
        console.log("[Admin] Support tickets loaded:", data.tickets?.length || 0)
        setSupportTickets(data.tickets || [])
      } else {
        console.error("[Admin] Failed to load support tickets:", data)
        setSupportTickets([])
      }
    } catch (err) {
      console.error("[Admin] Error loading support tickets:", err)
      setError("Произошла ошибка при загрузке тикетов поддержки")
      setSupportTickets([])
    } finally {
      setLoadingSupportTickets(false)
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    setUsersError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{
        success: boolean
        users: AdminUser[]
        count: number
      }>("/api/admin/users", {
        method: "GET",
      })

      if (fetchError) {
        setUsersError(fetchError.message || "Не удалось загрузить пользователей")
        setUsers([])
        return
      }

      if (data?.success && data.users) {
        setUsers(data.users)
      } else {
        setUsers([])
      }
    } catch (err) {
      console.error("[Admin] Error loading users:", err)
      setUsersError("Произошла ошибка при загрузке пользователей")
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadSiteSettings = async () => {
    try {
      const { data, error: fetchError } = await safeFetch<{
        gateEnabled: boolean
        productionMode: boolean
        hasPassword: boolean
      }>("/api/admin/site-settings", { method: "GET" })
      if (!fetchError && data) {
        setSiteSettings({
          gateEnabled: data.gateEnabled ?? false,
          productionMode: data.productionMode ?? true,
          hasPassword: data.hasPassword ?? false,
        })
      } else {
        setSiteSettings({ gateEnabled: false, productionMode: true, hasPassword: false })
      }
    } catch {
      setSiteSettings({ gateEnabled: false, productionMode: true, hasPassword: false })
    }
  }

  const saveSiteSettings = async (updates: { gatePassword?: string | null; productionMode?: boolean }) => {
    setSiteSettingsSaving(true)
    setSiteSettingsError(null)
    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean }>(
        "/api/admin/site-settings",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      )
      if (fetchError || !data?.success) {
        setSiteSettingsError(fetchError || "Не удалось сохранить настройки")
        return
      }
      await loadSiteSettings()
      setSiteSettingsPassword("")
    } catch (err) {
      setSiteSettingsError("Ошибка сохранения")
    } finally {
      setSiteSettingsSaving(false)
    }
  }

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string, response?: string) => {
    setUpdatingTicket(true)
    setTicketError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean }>(
        "/api/admin/support-tickets",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId,
            status: newStatus,
            adminResponse: response || undefined,
          }),
        }
      )

      if (fetchError || !data?.success) {
        setTicketError(fetchError || "Не удалось обновить тикет")
        return
      }

      setSelectedTicket(null)
      setTicketResponse("")
      setTicketError(null)
      loadSupportTickets()
    } catch (err) {
      console.error("Error updating ticket:", err)
      setTicketError("Произошла ошибка при обновлении тикета")
    } finally {
      setUpdatingTicket(false)
    }
  }

  const handleUpdateStatus = async (report: Report, newStatus: string) => {
    setUpdatingStatus(true)
    setError(null)

    try {
      const { data, error: fetchError } = await safeFetch<{ success: boolean; report: any }>(
        "/api/admin/reports",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: report.id,
            status: newStatus,
            adminNotes: statusUpdateNotes || null,
          }),
        }
      )

      if (fetchError) {
        setError(fetchError.message || "Не удалось обновить статус")
        return
      }

      if (data?.success) {
        setSelectedReportForStatus(null)
        setStatusUpdateNotes("")
        loadReports()
      } else {
        setError("Не удалось обновить статус")
      }
    } catch (err) {
      console.error("Error updating report status:", err)
      setError("Произошла ошибка при обновлении статуса")
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    )
  }

  if (!isAdmin || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Доступ запрещен
            </CardTitle>
            <CardDescription>{error || "У вас нет доступа к этой странице"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/lobby">
              <Button variant="outline" className="w-full">
                Вернуться в лобби
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
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
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Админ-панель</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Жалобы ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="bans" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Баны ({bans.filter((b) => b.is_active).length})
            </TabsTrigger>
            <TabsTrigger value="premium" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Премиум
            </TabsTrigger>
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Комнаты ({rooms.length})
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Поддержка ({supportTickets.filter((t) => t.status === "open").length})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Пользователи ({users.length})
            </TabsTrigger>
            <TabsTrigger value="site-settings" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Настройки сайта
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Жалобы пользователей</CardTitle>
                    <CardDescription>
                      Список всех жалоб на игроков. Проверяйте и принимайте решения.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedReportForBan(null)
                      setShowBanModal(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Создать бан
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : reports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет жалоб</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Жалобщик</TableHead>
                          <TableHead>Жалоба на</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Описание</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="text-sm">
                              {new Date(report.created_at).toLocaleString("ru-RU")}
                            </TableCell>
                            <TableCell>{report.reporter_name}</TableCell>
                            <TableCell>{report.reported_user_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{getReportTypeLabel(report.report_type)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={report.description}>
                              {report.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(report.status)}>
                                {getStatusLabel(report.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReportForStatus(report)
                                    setStatusUpdateNotes(report.admin_notes || "")
                                  }}
                                  title="Изменить статус"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleCreateBan(report)}
                                  title="Забанить пользователя"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bans Tab */}
          <TabsContent value="bans">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Забаненные пользователи</CardTitle>
                    <CardDescription>
                      Список всех активных и неактивных банов пользователей.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedReportForBan(null)
                      setShowBanModal(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Создать бан
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBans ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : bans.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет банов</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Пользователь</TableHead>
                          <TableHead>Забанил</TableHead>
                          <TableHead>Причина</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Истекает</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bans.map((ban) => (
                          <TableRow key={ban.id}>
                            <TableCell>{ban.user_name}</TableCell>
                            <TableCell>{ban.banned_by_name}</TableCell>
                            <TableCell className="max-w-xs truncate">{ban.reason}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {ban.ban_type === "permanent" ? "Постоянный" : "Временный"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {ban.expires_at
                                ? new Date(ban.expires_at).toLocaleString("ru-RU")
                                : "Никогда"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ban.is_active ? "destructive" : "outline"}>
                                {ban.is_active ? "Активен" : "Неактивен"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-primary" />
                      Управление премиум подписками
                    </CardTitle>
                    <CardDescription>
                      Выдача премиум подписки зарегистрированным пользователям по email
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowPremiumModal(true)}>
                    <Crown className="w-4 h-4 mr-2" />
                    Выдать премиум
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loadingPremiumUsers ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : premiumUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Crown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Нет премиум пользователей</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Имя пользователя</TableHead>
                            <TableHead>Игр сыграно</TableHead>
                            <TableHead>Побед</TableHead>
                            <TableHead>Срок действия</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {premiumUsers.map((premiumUser) => (
                            <TableRow
                              key={premiumUser.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedPremiumUser(premiumUser)}
                            >
                              <TableCell className="font-medium">
                                {premiumUser.email || "N/A"}
                              </TableCell>
                              <TableCell>
                                {premiumUser.display_name || premiumUser.username || "N/A"}
                              </TableCell>
                              <TableCell>{premiumUser.games_played || 0}</TableCell>
                              <TableCell>{premiumUser.games_won || 0}</TableCell>
                              <TableCell>
                                {premiumUser.premium_expires_at
                                  ? new Date(premiumUser.premium_expires_at).toLocaleDateString("ru-RU")
                                  : "Постоянная"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={premiumUser.isExpired ? "destructive" : "default"}
                                >
                                  {premiumUser.isExpired ? "Истекла" : "Активна"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedPremiumUser(premiumUser)
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Игровые комнаты</CardTitle>
                    <CardDescription>
                      Список всех созданных игровых комнат. Вы можете просматривать и удалять комнаты.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCleanupRooms}
                      disabled={cleaningRooms || loadingRooms}
                    >
                      {cleaningRooms ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Очистить пустые
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadRooms} disabled={loadingRooms}>
                      {loadingRooms ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      Обновить
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRooms ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : rooms.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет активных комнат</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Код</TableHead>
                          <TableHead>Хост</TableHead>
                          <TableHead>Фаза</TableHead>
                          <TableHead>Игроки</TableHead>
                          <TableHead>Раунд</TableHead>
                          <TableHead>Создана</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rooms.map((room) => (
                          <TableRow key={room.id}>
                            <TableCell className="font-mono font-bold">{room.room_code}</TableCell>
                            <TableCell>{room.host_name}</TableCell>
                            <TableCell>
                              <Badge variant={getPhaseBadgeVariant(room.phase)}>
                                {getPhaseLabel(room.phase)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {room.is_empty ? (
                                <span className="text-muted-foreground">Пустая</span>
                              ) : (
                                <>
                                  {room.real_player_count || room.active_player_count} / {room.max_players}
                                  {room.player_count !== (room.real_player_count || room.active_player_count) && (
                                    <span className="text-muted-foreground text-xs ml-1">
                                      ({room.player_count} в БД)
                                    </span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell>{room.current_round}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(room.created_at).toLocaleString("ru-RU")}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteRoom(room.id, room.room_code)}
                                title="Удалить комнату"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tickets Tab */}
          <TabsContent value="support">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Тикеты поддержки</CardTitle>
                    <CardDescription>
                      Просмотр и обработка обращений пользователей в поддержку
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadSupportTickets} disabled={loadingSupportTickets}>
                    {loadingSupportTickets ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    Обновить
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSupportTickets ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : supportTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Тикетов нет</div>
                ) : (
                  <div className="space-y-4">
                    {supportTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className={`bg-card/30 border-border/50 ${
                          ticket.status === "open" ? "border-primary/50" : ""
                        }`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-base">{ticket.subject}</CardTitle>
                                <Badge
                                  variant={
                                    ticket.status === "open"
                                      ? "default"
                                      : ticket.status === "in_progress"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {ticket.status === "open"
                                    ? "Открыт"
                                    : ticket.status === "in_progress"
                                      ? "В работе"
                                      : ticket.status === "resolved"
                                        ? "Решен"
                                        : "Закрыт"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {ticket.category === "general"
                                    ? "Общий"
                                    : ticket.category === "technical"
                                      ? "Технический"
                                      : ticket.category === "billing"
                                        ? "Подписка"
                                        : ticket.category === "bug"
                                          ? "Ошибка"
                                          : ticket.category === "suggestion"
                                            ? "Предложение"
                                            : "Другое"}
                                </Badge>
                              </div>
                              <CardDescription>
                                {ticket.user?.displayName || ticket.user?.username || "Анонимный пользователь"} •{" "}
                                {ticket.email} •{" "}
                                {new Date(ticket.createdAt).toLocaleString("ru-RU", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </CardDescription>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTicket(ticket)
                                setTicketResponse(ticket.adminResponse || "")
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Просмотреть
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">
                            {ticket.message}
                          </p>
                          {ticket.adminResponse && (
                            <div className="mt-3 p-3 bg-muted/50 rounded border border-border/50">
                              <p className="text-xs text-muted-foreground mb-1">Ответ администратора:</p>
                              <p className="text-sm whitespace-pre-wrap">{ticket.adminResponse}</p>
                              {ticket.admin && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {ticket.admin.displayName || ticket.admin.username} •{" "}
                                  {ticket.resolvedAt
                                    ? new Date(ticket.resolvedAt).toLocaleString("ru-RU")
                                    : new Date(ticket.updatedAt).toLocaleString("ru-RU")}
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Зарегистрированные пользователи</CardTitle>
                    <CardDescription>
                      Список всех пользователей с профилями. Нажмите на профиль, чтобы просмотреть данные на сайте.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadUsers} disabled={loadingUsers}>
                    {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usersError && (
                  <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded text-sm flex items-center justify-between">
                    <span>{usersError}</span>
                    <Button variant="outline" size="sm" onClick={loadUsers}>
                      Повторить
                    </Button>
                  </div>
                )}
                {loadingUsers ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : users.length === 0 && !usersError ? (
                  <p className="text-center text-muted-foreground py-8">Нет зарегистрированных пользователей</p>
                ) : users.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Пользователь</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Подписка</TableHead>
                          <TableHead>Игр / Побед</TableHead>
                          <TableHead>Регистрация</TableHead>
                          <TableHead>Профиль</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{u.display_name || u.username}</span>
                                <span className="text-xs text-muted-foreground">@{u.username}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {u.email || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.subscription_tier === "premium" ? "default" : "secondary"}>
                                {u.subscription_tier === "premium" ? "Премиум" : "Базовый"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {u.games_played} / {u.games_won}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString("ru-RU")}
                            </TableCell>
                            <TableCell>
                              <Link href={`/profile/${u.id}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm" title="Открыть профиль на сайте">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Site Settings Tab */}
          <TabsContent value="site-settings">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Настройки сайта
                </CardTitle>
                <CardDescription>
                  Пароль для входа на сайт и режим работы (продакшен / разработка)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {siteSettingsError && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">
                    {siteSettingsError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Пароль для доступа на сайт</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Если пароль установлен, посетители видят страницу «Сайт в процессе разработки» и поле для ввода пароля. Оставьте пустым, чтобы сайт работал как обычно.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={siteSettings?.hasPassword ? "Новый пароль (оставьте пустым, чтобы убрать)" : "Введите пароль"}
                        value={siteSettingsPassword}
                        onChange={(e) => setSiteSettingsPassword(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button
                        onClick={() => saveSiteSettings({ gatePassword: siteSettingsPassword })}
                        disabled={siteSettingsSaving}
                      >
                        {siteSettingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить пароль"}
                      </Button>
                    </div>
                    {siteSettings?.hasPassword && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Пароль установлен. Введите новый и сохраните, чтобы изменить, или оставьте пустым и сохраните, чтобы отключить.
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Режим продакшен</Label>
                        <p className="text-sm text-muted-foreground">
                          Включён: скрыты дебаг-элементы (Shift+U в игре). Выключен: показываются дебаг-элементы.
                        </p>
                      </div>
                      <Switch
                        checked={siteSettings?.productionMode ?? true}
                        onCheckedChange={(checked) => saveSiteSettings({ productionMode: checked })}
                        disabled={siteSettingsSaving}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Сейчас: <strong>{siteSettings?.productionMode ? "Продакшен (без дебага)" : "Режим разработки (с дебагом)"}</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Ticket Detail Dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null)
            setTicketError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
              Обращение от {selectedTicket?.user?.displayName || selectedTicket?.user?.username || "Анонимного пользователя"} ({selectedTicket?.email})
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Сообщение</Label>
                <div className="p-3 bg-muted/50 rounded border border-border/50">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>
              </div>

              {ticketError && (
                <div className="p-3 bg-destructive/10 text-destructive rounded text-sm mb-4">
                  {ticketError}
                </div>
              )}
              <div>
                <Label htmlFor="ticket-response" className="text-sm font-semibold mb-2 block">
                  Ответ администратора
                </Label>
                <Textarea
                  id="ticket-response"
                  value={ticketResponse}
                  onChange={(e) => setTicketResponse(e.target.value)}
                  placeholder="Введите ответ пользователю..."
                  rows={6}
                  disabled={updatingTicket}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleUpdateTicketStatus(selectedTicket.id, "in_progress")}
                  disabled={updatingTicket || selectedTicket.status === "in_progress"}
                >
                  В работу
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUpdateTicketStatus(selectedTicket.id, "resolved", ticketResponse)}
                  disabled={updatingTicket || selectedTicket.status === "resolved"}
                >
                  Решить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUpdateTicketStatus(selectedTicket.id, "closed", ticketResponse)}
                  disabled={updatingTicket || selectedTicket.status === "closed"}
                >
                  Закрыть
                </Button>
                <Button variant="outline" onClick={() => setSelectedTicket(null)} disabled={updatingTicket}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Ban Modal */}
      <CreateBanModal
        open={showBanModal}
        onOpenChange={setShowBanModal}
        userId={selectedReportForBan?.reported_user_id}
        userName={selectedReportForBan?.reported_user_name || undefined}
        onSuccess={handleBanSuccess}
      />

      {/* Grant Premium Modal */}
      <GrantPremiumModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
        onSuccess={() => {
          setShowPremiumModal(false)
          loadPremiumUsers()
        }}
      />

      {/* Premium User Details Dialog */}
      <Dialog
        open={!!selectedPremiumUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPremiumUser(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Детали премиум пользователя
            </DialogTitle>
            <DialogDescription>
              Информация о пользователе и его премиум подписке
            </DialogDescription>
          </DialogHeader>

          {selectedPremiumUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <p className="text-sm font-medium">{selectedPremiumUser.email || "N/A"}</p>
                </div>
                <div>
                  <Label>Имя пользователя</Label>
                  <p className="text-sm font-medium">
                    {selectedPremiumUser.display_name || selectedPremiumUser.username || "N/A"}
                  </p>
                </div>
                <div>
                  <Label>Игр сыграно</Label>
                  <p className="text-sm font-medium">{selectedPremiumUser.games_played || 0}</p>
                </div>
                <div>
                  <Label>Побед</Label>
                  <p className="text-sm font-medium">{selectedPremiumUser.games_won || 0}</p>
                </div>
                <div>
                  <Label>Дата регистрации</Label>
                  <p className="text-sm font-medium">
                    {new Date(selectedPremiumUser.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div>
                  <Label>Срок действия премиум</Label>
                  <p className="text-sm font-medium">
                    {selectedPremiumUser.premium_expires_at
                      ? new Date(selectedPremiumUser.premium_expires_at).toLocaleString("ru-RU")
                      : "Постоянная"}
                  </p>
                </div>
                <div>
                  <Label>Статус</Label>
                  <Badge variant={selectedPremiumUser.isExpired ? "destructive" : "default"}>
                    {selectedPremiumUser.isExpired ? "Истекла" : "Активна"}
                  </Badge>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedPremiumUser(null)}
                  disabled={revokingPremium}
                >
                  Закрыть
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRevokePremium(selectedPremiumUser.id)}
                  disabled={revokingPremium}
                >
                  {revokingPremium ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Отмена...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Отменить премиум
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Report Status Dialog */}
      <Dialog
        open={!!selectedReportForStatus}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReportForStatus(null)
            setStatusUpdateNotes("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Изменить статус жалобы</DialogTitle>
            <DialogDescription>
              Выберите новый статус для жалобы и добавьте примечания (опционально).
            </DialogDescription>
          </DialogHeader>

          {selectedReportForStatus && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Текущий статус:</p>
                <Badge variant={getStatusBadgeVariant(selectedReportForStatus.status)}>
                  {getStatusLabel(selectedReportForStatus.status)}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Жалоба на:</p>
                <p className="font-medium">{selectedReportForStatus.reported_user_name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Описание:</p>
                <p className="text-sm">{selectedReportForStatus.description}</p>
              </div>

              <div className="space-y-2">
                <Label>Новый статус:</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedReportForStatus.status === "reviewing" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedReportForStatus, "reviewing")}
                    disabled={updatingStatus || selectedReportForStatus.status === "reviewing"}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    В рассмотрении
                  </Button>
                  <Button
                    variant={selectedReportForStatus.status === "resolved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedReportForStatus, "resolved")}
                    disabled={updatingStatus || selectedReportForStatus.status === "resolved"}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Решено
                  </Button>
                  <Button
                    variant={selectedReportForStatus.status === "dismissed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedReportForStatus, "dismissed")}
                    disabled={updatingStatus || selectedReportForStatus.status === "dismissed"}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Отклонено
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Примечания администратора (опционально):</Label>
                <Textarea
                  id="adminNotes"
                  value={statusUpdateNotes}
                  onChange={(e) => setStatusUpdateNotes(e.target.value)}
                  placeholder="Добавьте примечания..."
                  rows={3}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">До 1000 символов</p>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedReportForStatus(null)
                    setStatusUpdateNotes("")
                  }}
                  disabled={updatingStatus}
                >
                  Отмена
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
