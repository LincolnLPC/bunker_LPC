"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Lottie from "lottie-react"
import type { CameraEffectType } from "@/lib/camera-effects/config"
import { cn } from "@/lib/utils"

/** Общая обёртка: анимация по центру камеры */
const effectCenterWrapperClass =
  "absolute inset-0 pointer-events-none z-30 flex items-center justify-center"

/** Размер области анимации: 2/3 камеры игрока */
const effectBoxClass = "w-2/3 h-2/3 min-w-0 min-h-0 flex items-center justify-center"

interface CameraEffectOverlayProps {
  effect: CameraEffectType
  onComplete?: () => void
  className?: string
}

function TomatoLottieEffect(props: { onComplete?: () => void; className?: string; completedRef: React.RefObject<boolean> }) {
  const { onComplete, className, completedRef } = props
  const [animationData, setAnimationData] = useState<object | null>(null)
  const lottieRef = useRef<any>(null)

  useEffect(() => {
    fetch("/animations/tomato-effect.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch((e) => console.warn("[CameraEffect] Failed to load tomato Lottie:", e))
  }, [])

  const startReverse = useCallback(() => {
    const anim = lottieRef.current
    if (!anim) return
    try {
      const totalFrames = anim.getDuration?.(true) ?? (anim as any).totalFrames ?? 0
      if (totalFrames > 0) {
        anim.stop?.()
        anim.setDirection(-1)
        anim.goToAndPlay(totalFrames - 1, true)
      }
    } catch (e) {
      console.debug("[CameraEffect] Tomato reverse play failed:", e)
    }
  }, [])

  useEffect(() => {
    if (!animationData) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) startReverse()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [animationData, startReverse])

  const handleComplete = () => {
    if (!completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }

  if (!animationData) {
    return (
      <div className={cn(effectCenterWrapperClass, className)}>
        <div className={effectBoxClass}>
          <div className="w-12 h-12 rounded-full bg-[#e74c3c] animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(effectCenterWrapperClass, "overflow-hidden", className)}>
      <div className={effectBoxClass}>
        <div className="w-full h-full">
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={false}
            autoplay={false}
            onDOMLoaded={startReverse}
            onComplete={handleComplete}
            style={{ width: "100%", height: "100%" }}
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
          />
        </div>
      </div>
    </div>
  )
}

function EggLottieEffect(props: { onComplete?: () => void; className?: string; completedRef: React.RefObject<boolean> }) {
  return (
    <LottieEffect
      {...props}
      src="/animations/egg-effect.json"
      fallback={<div className="w-10 h-14 rounded-[50%] bg-[#fff8dc] animate-pulse" />}
    />
  )
}

function applyCrackTransform(anim: any) {
  try {
    const renderer = anim.renderer
    if (!renderer?.elements) return
    renderer.elements.forEach((el: any) => {
      if (el?.data?.nm === "Crack") {
        if (el.layer?.transform?.rotation?.setValue) {
          el.layer.transform.rotation.setValue(Math.random() * 360)
        }
        if (el.layer?.transform?.scale?.setValue) {
          const scale = 80 + Math.random() * 50
          el.layer.transform.scale.setValue([scale, scale, 100])
        }
      }
    })
  } catch (e) {
    console.debug("[CameraEffect] Crack transform failed:", e)
  }
}

function RevolverLottieEffect(props: { onComplete?: () => void; className?: string; completedRef: React.RefObject<boolean> }) {
  const { onComplete, className, completedRef } = props
  const [animationData, setAnimationData] = useState<object | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<any>(null)
  const shakeDoneRef = useRef(false)

  useEffect(() => {
    fetch("/animations/revolver-effect.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch((e) => console.warn("[CameraEffect] Failed to load revolver Lottie:", e))
  }, [])

  useEffect(() => {
    if (!animationData || !containerRef.current || shakeDoneRef.current) return
    shakeDoneRef.current = true
    const intensity = 6
    containerRef.current.animate(
      [
        { transform: "translate(0px, 0px)" },
        { transform: `translate(${intensity}px, -${intensity}px)` },
        { transform: `translate(-${intensity}px, ${intensity}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: 120, iterations: 1 }
    )
  }, [animationData])

  useEffect(() => {
    if (!animationData) return
    let cancelled = false
    const run = () => {
      const anim = lottieRef.current
      if (!anim || cancelled) return
      const onDOMLoaded = () => applyCrackTransform(anim)
      if (anim.isLoaded || (anim.renderer?.elements?.length ?? 0) > 0) {
        onDOMLoaded()
      } else {
        anim.addEventListener("DOMLoaded", onDOMLoaded)
        return () => anim.removeEventListener("DOMLoaded", onDOMLoaded)
      }
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(run))
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [animationData])

  const handleComplete = () => {
    if (!completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }

  if (!animationData) {
    return (
      <div className={cn(effectCenterWrapperClass, className)}>
        <div className={effectBoxClass}>
          <div className="w-24 h-24 rounded-full bg-white/80 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(effectCenterWrapperClass, "overflow-hidden", className)}
    >
      <div className={effectBoxClass}>
        <div className="w-full h-full">
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={false}
            onComplete={handleComplete}
            style={{ width: "100%", height: "100%" }}
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
          />
        </div>
      </div>
    </div>
  )
}

function LottieEffect({
  src,
  fallback,
  onComplete,
  className,
  completedRef,
}: {
  src: string
  fallback: React.ReactNode
  onComplete?: () => void
  className?: string
  completedRef: React.RefObject<boolean>
}) {
  const [animationData, setAnimationData] = useState<object | null>(null)

  useEffect(() => {
    fetch(src)
      .then((res) => res.json())
      .then(setAnimationData)
      .catch((e) => console.warn("[CameraEffect] Failed to load Lottie:", src, e))
  }, [src])

  const handleComplete = () => {
    if (!completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }

  if (!animationData) {
    return (
      <div className={cn(effectCenterWrapperClass, className)}>
        <div className={effectBoxClass}>{fallback}</div>
      </div>
    )
  }

  return (
    <div className={cn(effectCenterWrapperClass, "overflow-hidden", className)}>
      <div className={effectBoxClass}>
        <div className="w-full h-full">
          <Lottie
            animationData={animationData}
            loop={false}
            onComplete={handleComplete}
            style={{ width: "100%", height: "100%" }}
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
          />
        </div>
      </div>
    </div>
  )
}

export function CameraEffectOverlay({ effect, onComplete, className }: CameraEffectOverlayProps) {
  const completedRef = useRef(false)

  useEffect(() => {
    const duration = effect === "revolver" ? 3000 : effect === "tomato" ? 3000 : effect === "egg" ? 3500 : 2500
    const t = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
    }, duration)
    return () => clearTimeout(t)
  }, [effect, onComplete])

  if (effect === "tomato") {
    return (
      <TomatoLottieEffect onComplete={onComplete} className={className} completedRef={completedRef} />
    )
  }

  if (effect === "egg") {
    return (
      <EggLottieEffect onComplete={onComplete} className={className} completedRef={completedRef} />
    )
  }

  if (effect === "revolver") {
    return (
      <RevolverLottieEffect onComplete={onComplete} className={className} completedRef={completedRef} />
    )
  }

  return null
}
