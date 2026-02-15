"use client"

import { useEffect, useState } from "react"

const OVERLAY_SELECTORS = [
  "nextjs-portal",
  "[data-nextjs-toast-errors-root]",
  "[data-nextjs-dialog]",
]

/**
 * Скрывает оригинальный Next.js dev indicator при production_mode=true.
 * При production_mode=false — показывает (полнофункциональный, кликабельный).
 */
export function DevIndicatorGate() {
  const [productionMode, setProductionMode] = useState<boolean | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    let cancelled = false
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProductionMode(data.productionMode !== false)
      })
      .catch(() => {
        if (!cancelled) setProductionMode(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || productionMode === null) return

    const findOverlay = (): Element | null => {
      const byTag = document.querySelector("nextjs-portal")
      if (byTag) return byTag
      for (const sel of OVERLAY_SELECTORS) {
        const el = document.querySelector(sel)
        if (el) return el
      }
      for (const child of document.body.children) {
        if (child.id === "__next") continue
        if (child.shadowRoot?.querySelector("[data-nextjs-toast], [data-nextjs-dialog]")) {
          return child
        }
      }
      return null
    }

    const apply = () => {
      const overlay = findOverlay()
      if (!overlay) return
      const el = overlay as HTMLElement
      if (productionMode) {
        el.style.setProperty("display", "none", "important")
      } else {
        el.style.removeProperty("display")
      }
    }

    apply()
    const mo = new MutationObserver(apply)
    mo.observe(document.body, { childList: true, subtree: true })
    const iv = window.setInterval(apply, 300)

    return () => {
      mo.disconnect()
      clearInterval(iv)
      const overlay = findOverlay()
      if (overlay) (overlay as HTMLElement).style.removeProperty("display")
    }
  }, [productionMode])

  return null
}
