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
import { Flame, ArrowLeft, AlertTriangle, Shield, Ban, Loader2, AlertCircle, Plus, Check, X, Eye, Trash2, Gamepad2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { CreateBanModal } from "@/components/admin/create-ban-modal"
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
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Комнаты ({rooms.length})
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
        </Tabs>
      </main>

      {/* Create Ban Modal */}
      <CreateBanModal
        open={showBanModal}
        onOpenChange={setShowBanModal}
        userId={selectedReportForBan?.reported_user_id}
        userName={selectedReportForBan?.reported_user_name || undefined}
        onSuccess={handleBanSuccess}
      />

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
