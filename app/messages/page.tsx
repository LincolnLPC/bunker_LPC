"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageSquare, Send, Loader2, Circle, Smile, ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isUserOnline } from "@/lib/online"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { STICKERS, parseStickerCode, isStickerCode } from "@/lib/stickers"
import { cn } from "@/lib/utils"

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
  "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😝",
  "👍", "👎", "👊", "✊", "🤞", "✌️", "👌", "👋", "💪", "🙏",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💕", "🔥",
  "⭐", "✨", "💫", "🌸", "🎮", "🎯", "🎉", "🎊", "🎁", "🏆",
  "✅", "❌",
]

function parseMessageBody(body: string): { type: "text" | "image" | "sticker"; content?: string; url?: string; stickerId?: string; caption?: string } {
  const t = body.trim()
  if (!t) return { type: "text", content: "" }
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as { type?: string; url?: string; caption?: string }
      if (j.type === "image" && j.url) return { type: "image", url: j.url, caption: j.caption }
    } catch {}
  }
  const stickerId = parseStickerCode(t)
  if (stickerId) return { type: "sticker", stickerId }
  return { type: "text", content: body }
}

function MessageBubbleBody({ body, isMe }: { body: string; isMe: boolean }) {
  const parsed = parseMessageBody(body)
  if (parsed.type === "image") {
    return (
      <div className="space-y-1">
        <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden max-w-[280px]">
          <img src={parsed.url!} alt="Фото" className="max-h-64 w-full object-cover rounded" />
        </a>
        {parsed.caption && <p className="text-sm whitespace-pre-wrap break-words">{parsed.caption}</p>}
      </div>
    )
  }
  if (parsed.type === "sticker" && parsed.stickerId) {
    const sticker = STICKERS.find((s) => s.id === parsed.stickerId)
    if (sticker) {
      return (
        <div className="inline-block">
          <Image src={sticker.src} alt={sticker.alt} width={80} height={80} className="object-contain" unoptimized />
        </div>
      )
    }
  }
  return <p className="text-sm whitespace-pre-wrap break-words">{parsed.content ?? body}</p>
}

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
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({})
  const [imageUploading, setImageUploading] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const loadConversations = async (): Promise<Conversation[]> => {
    const [listRes, unreadRes] = await Promise.all([
      fetch("/api/messages"),
      fetch("/api/messages/unread-by-user"),
    ])
    const data = await listRes.json()
    const unreadData = unreadRes.ok ? await unreadRes.json() : {}
    if (listRes.ok) {
      if (data.conversations) setConversations(data.conversations)
      if (typeof data.total_unread === "number") setTotalUnread(data.total_unread)
      setUnreadByUser(typeof unreadData === "object" && unreadData !== null ? unreadData : {})
      return data.conversations || []
    }
    return []
  }

  const loadThread = async (userId: string) => {
    const res = await fetch(`/api/messages?with=${userId}`)
    const data = await res.json()
    if (!res.ok) return
    setMessages(data.messages || [])
    setOtherUser(data.other ? { ...data.other, id: userId } : null)
    // Mark all messages from this user as read when opening the dialog
    const readRes = await fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_user_id: userId }),
    })
    if (readRes.ok) await loadConversations()
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
      const list = await loadConversations()
      await loadFriendsAndRequests()
      if (withUserId) {
        await loadThread(withUserId)
      } else {
        // If opened from lobby/notification with unread — open first unread dialog so user sees who wrote
        const firstUnread = list?.find((c) => (c.unread_count || 0) > 0)
        if (firstUnread) {
          router.replace(`/messages?with=${firstUnread.user_id}`)
          return
        }
      }
      setLoading(false)
    }
    run()
  }, [withUserId, router])

  // Refresh conversations when tab gets focus (so new messages show unread badge) and periodically
  useEffect(() => {
    const onFocus = () => {
      loadConversations()
    }
    window.addEventListener("focus", onFocus)
    const interval = setInterval(loadConversations, 20000)
    return () => {
      window.removeEventListener("focus", onFocus)
      clearInterval(interval)
    }
  }, [])

  const sendMessage = async (bodyOverride?: string) => {
    const toSend = (bodyOverride !== undefined ? bodyOverride : newBody).trim()
    if (!withUserId || (!toSend && bodyOverride === undefined) || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_user_id: withUserId, body: bodyOverride !== undefined ? bodyOverride : newBody.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message])
        if (bodyOverride === undefined) setNewBody("")
        setEmojiOpen(false)
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

  const handleEmojiSelect = (value: string) => {
    if (isStickerCode(value)) {
      sendMessage(value)
      return
    }
    const input = inputRef.current
    if (input) {
      const start = input.selectionStart ?? newBody.length
      const end = input.selectionEnd ?? newBody.length
      const next = newBody.slice(0, start) + value + newBody.slice(end)
      setNewBody(next)
      setTimeout(() => { input.focus(); input.setSelectionRange(start + value.length, start + value.length) }, 0)
    } else {
      setNewBody((prev) => prev + value)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !withUserId) return
    if (!file.type.startsWith("image/")) {
      alert("Выберите изображение (JPEG, PNG, GIF, WebP)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Файл не более 5 МБ")
      return
    }
    setImageUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/messages/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки")
      const caption = newBody.trim() || undefined
      const bodyStr = JSON.stringify({ type: "image", url: data.url, caption })
      await sendMessage(bodyStr)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки изображения")
    } finally {
      setImageUploading(false)
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background pointer-events-none" />

      <header className="relative z-10 flex-shrink-0 flex items-center gap-4 px-4 py-3 border-b border-border/50">
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

      <main className="relative z-10 flex-1 flex min-h-0 overflow-hidden w-full max-w-6xl mx-auto">
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
                {conversations.map((c) => {
                  const unread = Number(unreadByUser[c.user_id] ?? c.unread_count ?? 0)
                  return (
                    <li key={c.user_id}>
                      <Link
                        href={`/messages?with=${c.user_id}`}
                        className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${withUserId === c.user_id ? "bg-muted/50" : ""} ${unread > 0 ? "bg-primary/5" : ""}`}
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback>{(c.display_name || c.username)[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}>{c.display_name || c.username}</span>
                            {unread > 0 && (
                              <Badge className="h-5 min-w-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground shrink-0 flex items-center justify-center">
                                {unread > 99 ? "99+" : unread}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {c.last_message_from_me ? "Вы: " : ""}
                            {c.last_activity_at ? new Date(c.last_activity_at).toLocaleString("ru-RU") : ""}
                            {unread > 0 && !c.last_message_from_me && (
                              <span className="ml-1 text-primary font-medium">• Новые</span>
                            )}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {/* Friends with no conversation yet */}
            {friends.filter((f) => !conversations.some((c) => c.user_id === f.friend_user_id)).length > 0 && (
              <div className="p-3 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-2">Друзья</p>
                <ul className="space-y-1">
                  {friends.filter((f) => !conversations.some((c) => c.user_id === f.friend_user_id)).map((f) => {
                    const friendUnread = Number(unreadByUser[f.friend_user_id] ?? 0)
                    return (
                    <li key={f.friend_user_id}>
                      <Link
                        href={`/messages?with=${f.friend_user_id}`}
                        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${withUserId === f.friend_user_id ? "bg-muted/50" : ""} ${friendUnread > 0 ? "bg-primary/5" : ""}`}
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{(f.display_name || f.username)[0]}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 min-w-0 font-medium truncate">{f.display_name || f.username}</span>
                        {friendUnread > 0 && (
                          <Badge className="h-5 min-w-5 px-1.5 text-xs font-semibold bg-primary text-primary-foreground shrink-0 flex items-center justify-center">
                            {friendUnread > 99 ? "99+" : friendUnread}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  )})}
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

        {/* Center: selected dialog — header and input fixed, only messages scroll */}
        {withUserId ? (
          <div className="flex-1 flex flex-col min-h-0 min-w-0 border-l border-border/50 h-full">
            {otherUser && (
              <div className="flex-shrink-0 py-2 px-4 flex items-center gap-2 text-sm text-muted-foreground border-b border-border/50 bg-background/95">
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 px-4 space-y-3">
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
                      <MessageBubbleBody body={m.body} isMe={isMe} />
                      <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString("ru-RU")}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex-shrink-0 py-3 flex gap-2 px-4 items-end border-t border-border/50 bg-background">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Смайлики и стикеры">
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start" side="top">
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <span className="text-xs font-medium text-muted-foreground col-span-2">Смайлики — вставка в текст. Стикеры — отдельным сообщением.</span>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-8 gap-1 mb-3">
                      {EMOJIS.map((emoji, i) => (
                        <button
                          key={i}
                          type="button"
                          className={cn("flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-muted transition-colors")}
                          onClick={() => handleEmojiSelect(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Стикеры</p>
                    <div className="grid grid-cols-3 gap-2">
                      {STICKERS.map((sticker) => (
                        <button
                          key={sticker.id}
                          type="button"
                          className={cn("flex aspect-square items-center justify-center rounded overflow-hidden hover:bg-muted transition-colors border border-transparent hover:border-border")}
                          onClick={() => handleEmojiSelect(`[sticker:${sticker.id}]`)}
                          title={sticker.alt}
                        >
                          <Image src={sticker.src} alt={sticker.alt} width={56} height={56} className="object-contain" unoptimized />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                title="Прикрепить картинку"
                disabled={imageUploading || sending}
                onClick={() => fileInputRef.current?.click()}
              >
                {imageUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              </Button>
              <Input
                ref={inputRef}
                placeholder="Сообщение..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                maxLength={5000}
                className="flex-1"
              />
              <Button onClick={() => sendMessage()} disabled={sending || !newBody.trim()} size="icon">
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
