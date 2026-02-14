"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Smile, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { STICKERS, stickerCode } from "@/lib/stickers"

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
  "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😝",
  "🤗", "🤭", "🤫", "🤔", "😐", "😏", "😒", "🙄", "😬", "🤥",
  "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
  "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘",
  "👌", "🤌", "🤏", "👋", "🤙", "💪", "🙏", "❤️", "🧡", "💛",
  "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞",
  "🔥", "⭐", "✨", "💫", "🌸", "🌹", "🌺", "🌻", "🌼", "🌷",
  "🎮", "🎯", "🎲", "🎭", "🎨", "🎤", "🎧", "☕", "🍕", "🍺",
  "🎉", "🎊", "🎁", "🎈", "🏆", "✅", "❌",
]

interface EmojiPickerProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          title="Смайлики и стикеры"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="top">
        <div className="flex gap-1 mb-2">
          <Button
            type="button"
            variant={tab === "emoji" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setTab("emoji")}
          >
            <Smile className="h-3.5 w-3.5 mr-1" />
            Смайлики
          </Button>
          <Button
            type="button"
            variant={tab === "stickers" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setTab("stickers")}
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1" />
            Стикеры
          </Button>
        </div>
        <ScrollArea className="h-[180px]">
          {tab === "emoji" && (
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded text-xl",
                    "hover:bg-muted transition-colors"
                  )}
                  onClick={() => onSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {tab === "stickers" && (
            <div className="grid grid-cols-3 gap-2">
              {STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className={cn(
                    "flex aspect-square items-center justify-center rounded overflow-hidden",
                    "hover:bg-muted transition-colors border border-transparent hover:border-border"
                  )}
                  onClick={() => onSelect(stickerCode(sticker.id))}
                  title={sticker.alt}
                >
                  <Image
                    src={sticker.src}
                    alt={sticker.alt}
                    width={64}
                    height={64}
                    className="w-full h-full object-contain max-h-16"
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
