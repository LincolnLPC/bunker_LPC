/**
 * Chat stickers - custom images that can be inserted into messages
 * Place images in public/stickers/
 */

export interface Sticker {
  id: string
  src: string
  alt: string
}

export const STICKERS: Sticker[] = [
  { id: "fox-wise", src: "/stickers/fox-wise.png", alt: "Лиса в очках" },
  { id: "fox-angry", src: "/stickers/fox-angry.png", alt: "Сердитая лиса" },
  { id: "hand-dagger", src: "/stickers/hand-dagger.png", alt: "Рука с кинжалом" },
  { id: "fox-peek", src: "/stickers/fox-peek.png", alt: "Лиса подглядывает" },
  { id: "fox-heart", src: "/stickers/fox-heart.png", alt: "Лиса с сердцем" },
]

export const STICKER_PREFIX = "[sticker:"
export const STICKER_SUFFIX = "]"

export function stickerCode(id: string): string {
  return `${STICKER_PREFIX}${id}${STICKER_SUFFIX}`
}

export function parseStickerCode(text: string): string | null {
  const match = text.match(/^\[sticker:([a-z0-9-]+)\]$/)
  return match ? match[1] : null
}

export function isStickerCode(text: string): boolean {
  return text.startsWith(STICKER_PREFIX) && text.endsWith(STICKER_SUFFIX)
}
