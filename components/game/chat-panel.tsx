"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Send, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
                  <span className="text-foreground">{msg.message}</span>
                </>
              )}
              {msg.type !== "chat" && <span>{msg.message}</span>}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите сообщение..."
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
