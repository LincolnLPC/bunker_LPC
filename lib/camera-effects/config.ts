/**
 * Camera effects configuration
 * Effects that players can "throw" at other players' video feeds
 */

export type CameraEffectType = "tomato" | "egg" | "revolver"

export interface CameraEffectDef {
  id: CameraEffectType
  name: string
  label: string
  durationMs: number
  icon: string // emoji for panel
}

export const CAMERA_EFFECTS: Record<CameraEffectType, CameraEffectDef> = {
  tomato: {
    id: "tomato",
    name: "tomato",
    label: "Помидор",
    durationMs: 3000,
    icon: "🍅",
  },
  egg: {
    id: "egg",
    name: "egg",
    label: "Яйцо",
    durationMs: 3500,
    icon: "🥚",
  },
  revolver: {
    id: "revolver",
    name: "revolver",
    label: "Револьвер",
    durationMs: 3000,
    icon: "🔫",
  },
}

export const CAMERA_EFFECT_DRAG_TYPE = "camera-effect"
export const EFFECT_ANIMATION_DURATION = 800
