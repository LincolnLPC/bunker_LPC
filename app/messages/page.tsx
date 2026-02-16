"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageSquare, Send, Loader2, Circle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isUserOnline } from "@/lib/online"

interface Conversation {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  last_activity_at: string
  last_message_from_me: boolean
  unread_count: number
}

interface FriendEntry {
  friend_user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface Message {
  id: string
  from_user_id: string
  to_user_id: string
  body: string
  read_at: string | null
  created_at: string
}

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const withUserId = searchParams?.get("with") || null

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null; show_online_status?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newBody, setNewBody] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [friendRequestsIncoming, setFriendRequestsIncoming] = useState<{ id?: string; user_id: string; username: string; display_name: string | null; avatar_url: string | null }[]>([])
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [totalUnread, setTotalUnread] = useState(0)

  const loadFriendsAndRequests = async () => {
    const res = await fetch("/api/friends")
    const data = await res.json()
    if (res.ok && data.friends) {
      const list = data.friends as any[]
      const incoming = list.filter((f) => f.is_incoming_request)
      setFriendRequestsIncoming(incoming.map((f) => ({ id: f.id, user_id: f.friend_user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url })))
      const accepted = list.filter((f) => f.status === "accepted").map((f) => ({ friend_user_id: f.friend_user_id, username: f.username, display_name: f.display_name, avatar_url: f.avatar_url }))
      setFriends(accepted)
    }
  }

  const loadConversations = async () => {
    const res = await fetch("/api/messages")
    const data = await res.json()
    if (res.ok) {
      if (data.conversations) setConversations(data.conversations)
      if (typeof data.total_unread === "number") setTotalUnread(data.total_unread)
    }
  }

  const loadThread = async (userId: string) => {
    const res = await fetch(`/api/messages?with=${userId}`)
    const data = await res.json()
    if (!res.ok) return
    setMessages(data.messages || [])
    setOtherUser(data.other ? { ...data.other, id: userId } : null)
    await fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_user_id: userId }),
    })
    loadConversations()
  }

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      setCurrentUserId(user.id)
      await loadConversations()
      await loadFriendsAndRequests()
      if (withUserId) await loadThread(withUserId)
      setLoading(false)
    }
    run()
  }, [withUserId, router])

  const sendMessage = async () => {
    if (!withUserId || !newBody.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: withUserId, body: newBody.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message])
        setNewBody("")
        loadConversations()
      } else {
        alert(data.error || "Ошибка отправки")
      }
    } catch (e) {
      alert("Ошибка отправки")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background pointer-events-none" />

      <header className="relative z-10 flex items-center gap-4 px-4 py-3 border-b border-border/50">
        <Link href={withUserId ? "/messages" : "/profile"}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <MessageSquare className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold flex items-center gap-2">
          {withUserId && otherUser ? (otherUser.display_name || otherUser.username) : "Сообщения"}
          {!withUserId && totalUnread > 0 && (
            <Badge className="bg-primary text-primary-foreground">
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </span>
      </header>

      <main className="relative z-10 flex-1 flex overflow-hidden w-full max-w-6xl mx-auto">
        {/* Left: list of friends and conversations (most recent first) */}
        <aside className="w-full sm:w-80 flex-shrink-0 border-r border-border/50 bg-card/30 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto min-h-0">
            {friendRequestsIncoming.length > 0 && (
              <div className="p-3 border-b border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-2">Заявки в друзья</p>
                <ul className="space-y-2">
                  {friendRequestsIncoming.map((r) => (
                    <li key={r.user_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                      <Link href={`/profile/${r.user_id}`} className="flex items-center gap-2 flex-1 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.avatar_url || undefined} />
                          <AvatarFallback>{(r.display_name || r.username)[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate text-sm">{r.display_name || r.username}</span>
                      </Link>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={async (e) => {
                            e.preventDefault()
                            await fetch("/api/friends", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "accept", request_id: r.id }),
                            })
                            loadFriendsAndRequests()
                            loadConversations()
                          }}
                        >
                          Принять
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async (e) => {
                            e.preventDefault()
                            await fetch("/api/friends", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "decline", request_id: r.id }),
                            })
                            loadFriendsAndRequests()
                          }}
                        >
                          Отклонить
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Conversations (sorted by most recent) + friends without dialog */}
            {conversations.length > 0 && (
              <ul className="divide-y divide-border/50">
                {conversations.map((c) => (
                  <li key={c.user_id}>
                    <Link
                      href={`/messages?with=${c.user_id}`}
                      className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${withUserId === c.user_id ? "bg-muted/50" : ""}`}
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback>{(c.display_name || c.username)[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{c.display_name || c.username}</span>
                          {c.unread_count > 0 && (
                            <Badge className="h-5 min-w-5 px-1.5 text-xs">{c.unread_count > 99 ? "99+" : c.unread_count}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {c.last_message_from_me ? "Вы: " : ""}
                          {c.last_activity_at ? new Date(c.last_activity_at).toLocaleString("ru-RU") : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {/* Friends with no conversation yet */}
            {friends.filter((f) => !conversations.some((c) => c.user_id === f.friend_user_id)).length > 0 && (
              <div className="p-3 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-2">Друзья</p>
                <ul className="space-y-1">
                  {friends.filter((f) => !conversations.some((c) => c.user_id === f.friend_user_id)).map((f) => (
                    <li key={f.friend_user_id}>
                      <Link
                        href={`/messages?with=${f.friend_user_id}`}
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${withUserId === f.friend_user_id ? "bg-muted/50" : ""}`}
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{(f.display_name || f.username)[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{f.display_name || f.username}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {conversations.length === 0 && friends.length === 0 && friendRequestsIncoming.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Нет диалогов. Добавьте друзей в профиле и напишите им.</p>
                <Link href="/profile" className="mt-3 inline-block">
                  <Button variant="outline" size="sm">К профилю</Button>
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* Center: selected dialog or placeholder */}
        {withUserId ? (
          <div className="flex-1 flex flex-col min-w-0 border-l border-border/50">
            {otherUser && (
              <div className="py-2 px-4 flex items-center gap-2 text-sm text-muted-foreground border-b border-border/50">
                <Link href={`/profile/${otherUser.id}`} className="hover:underline">
                  {otherUser.display_name || otherUser.username}
                </Link>
                {otherUser.show_online_status !== false && (
                  <span className={isUserOnline(otherUser.last_seen_at, true) ? "text-green-600" : ""}>
                    <Circle className="inline h-2 w-2 fill-current mr-1" />
                    {isUserOnline(otherUser.last_seen_at, true) ? "в сети" : "не в сети"}
                  </span>
                )}
              </div>
            )}
            <div className="flex-1 overflow-auto py-4 px-4 space-y-3">
              {messages.map((m) => {
                const isMe = m.from_user_id === currentUserId
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString("ru-RU")}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="py-3 flex gap-2 px-4">
              <Input
                placeholder="Сообщение..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                maxLength={2000}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={sending || !newBody.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-w-0 p-6 text-center text-muted-foreground">
            <MessageSquare className="h-16 w-16 mb-4 opacity-40" />
            <p className="text-lg font-medium">Выберите диалог</p>
            <p className="text-sm mt-1">Список друзей и диалогов — слева</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  )
}
