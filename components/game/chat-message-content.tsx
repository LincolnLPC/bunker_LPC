"use client"

import { STICKERS } from "@/lib/stickers"

const STICKER_REGEX = /\[sticker:([a-z0-9-]+)\]/g

export function ChatMessageContent({ text }: { text: string }) {
  const parts: Array<{ type: "text" | "sticker"; content: string }> = []
  let lastIndex = 0
  let match

  while ((match = STICKER_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: "sticker", content: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) })
  }

  if (parts.length === 0 && text) {
    parts.push({ type: "text", content: text })
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "sticker" ? (
          <StickerImage key={i} id={part.content} />
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </>
  )
}

function StickerImage({ id }: { id: string }) {
  const sticker = STICKERS.find((s) => s.id === id)
  if (!sticker) return <span>[sticker:{id}]</span>

  return (
    <img
      src={sticker.src}
      alt={sticker.alt}
      className="inline-block align-middle w-8 h-8 object-contain mx-0.5"
    />
  )
}
