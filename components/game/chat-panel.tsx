"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Send, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmojiPicker } from "./emoji-picker"
import { ChatMessageContent } from "./chat-message-content"

interface ChatMessage {
  id: string
  playerId?: string
  playerName?: string
  message: string
  type: "chat" | "system" | "vote" | "reveal"
  timestamp: Date
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  currentPlayerName: string
  sending?: boolean
}

export function ChatPanel({ isOpen, onClose, messages, onSendMessage, currentPlayerName, sending = false }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current
    if (input) {
      const start = input.selectionStart ?? inputValue.length
      const end = input.selectionEnd ?? inputValue.length
      const newValue = inputValue.slice(0, start) + emoji + inputValue.slice(end)
      setInputValue(newValue)
      input.focus()
      requestAnimationFrame(() => {
        const pos = start + emoji.length
        input.setSelectionRange(pos, pos)
      })
    } else {
      setInputValue((prev) => prev + emoji)
    }
  }

  useEffect(() => {
    // Auto-scroll to bottom only when a new message is added (avoid scroll on every render)
    const lastMsg = messages[messages.length - 1]
    const lastId = lastMsg?.id ?? null
    if (lastId && lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId
      if (scrollRef.current) {
        requestAnimationFrame(() => {
          const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight
          }
        })
      }
    }
  }, [messages])

  const handleSend = () => {
    if (inputValue.trim() && !sending) {
      onSendMessage(inputValue.trim())
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-40 bg-card border-l-2 border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Чат</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "text-sm",
                msg.type === "system" && "text-muted-foreground italic text-center",
                msg.type === "vote" && "text-primary italic",
                msg.type === "reveal" && "text-[oklch(0.7_0.15_200)] italic",
              )}
            >
              {msg.type === "chat" && (
                <>
                  <span className="font-semibold text-primary">{msg.playerName}: </span>
                  <span className="text-foreground inline-flex flex-wrap items-center gap-0.5">
                    <ChatMessageContent text={msg.message} />
                  </span>
                </>
              )}
              {msg.type !== "chat" && <span>{msg.message}</span>}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2 items-center">
          <EmojiPicker onSelect={insertEmoji} disabled={sending} />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            className={cn(
              "flex-1 h-9 min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
