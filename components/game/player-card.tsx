"use client"

import { useRef, useEffect, useState } from "react"
import type { Player } from "@/types/game"
import { cn } from "@/lib/utils"
import { MicOff, VideoOff, User } from "lucide-react"
import { CameraEffectOverlay } from "./camera-effect-overlay"
import type { CameraEffectType } from "@/lib/camera-effects/config"
import { CAMERA_EFFECT_DRAG_TYPE } from "@/lib/camera-effects/config"

export interface ActiveCameraEffect {
  id: string
  effect: CameraEffectType
}

interface PlayerCardProps {
  player: Player
  slotNumber: number
  isCurrentPlayer?: boolean
  onToggleCharacteristic?: (characteristicId: string) => void
  onSelect?: () => void
  isMuted?: boolean
  onToggleMute?: () => void
  vdoNinjaCameraUrl?: string | null
  activeEffects?: ActiveCameraEffect[]
  onEffectDrop?: (effect: CameraEffectType) => void
  onEffectComplete?: (effectId: string) => void
}

export function PlayerCard({
  player,
  slotNumber,
  isCurrentPlayer = false,
  onToggleCharacteristic,
  onSelect,
  isMuted = false,
  onToggleMute,
  vdoNinjaCameraUrl,
  activeEffects = [],
  onEffectDrop,
  onEffectComplete,
}: PlayerCardProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(CAMERA_EFFECT_DRAG_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      setDragOver(true)
    }
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false)
    e.preventDefault()
    e.stopPropagation()
    const effect = (e.dataTransfer.getData(CAMERA_EFFECT_DRAG_TYPE) || e.dataTransfer.getData("text/plain")) as CameraEffectType
    const validEffects = ["tomato", "egg", "revolver"] as const
    if (effect && validEffects.includes(effect) && onEffectDrop) {
      onEffectDrop(effect)
    }
  }

  const handleDragOverInner = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(CAMERA_EFFECT_DRAG_TYPE)) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "copy"
      setDragOver(true)
    }
  }

  const handleDragLeaveInner = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) {
      setDragOver(false)
    }
  }
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [showCharacteristics, setShowCharacteristics] = useState(true)

  useEffect(() => {
    if (!videoRef.current) return

    const videoElement = videoRef.current
    const currentStream = player.stream

    // Always check if srcObject needs to be updated, even if stream reference is the same
    // This handles cases where stream tracks might have changed
    if (currentStream) {
      const videoTracks = currentStream.getVideoTracks()
      const hasVideoTrack = videoTracks.length > 0 && videoTracks.some(t => t.enabled && t.readyState === "live")
      
      console.log(`[PlayerCard] Processing stream for player ${player.name} (${player.id}):`, {
        streamId: currentStream.id,
        videoTracks: videoTracks.length,
        hasVideoTrack,
        videoEnabled: player.videoEnabled,
        isCurrentPlayer,
        srcObjectSet: !!videoElement.srcObject,
        srcObjectMatches: videoElement.srcObject === currentStream,
      })

      // Update srcObject if stream changed or if it's not set
      if (videoElement.srcObject !== currentStream) {
        videoElement.srcObject = currentStream
        streamRef.current = currentStream
        console.log(`[PlayerCard] Set srcObject for ${player.name}, streamId: ${currentStream.id}`)
      }

      // Try to play video if there's a video track
      if (hasVideoTrack) {
        const playPromise = videoElement.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[PlayerCard] Video playing for ${player.name}`)
            })
            .catch((err) => {
              // Silently ignore AbortError - it's expected when srcObject changes rapidly
              // Also ignore NotAllowedError (user interaction required)
              if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.warn(`[PlayerCard] Error playing video for ${player.name}:`, err.name, err.message)
              } else {
                console.debug(`[PlayerCard] Ignoring ${err.name} for ${player.name}`)
              }
            })
        }
      } else {
        console.debug(`[PlayerCard] No enabled video track for ${player.name}`)
      }
    } else {
      console.log(`[PlayerCard] No stream for player ${player.name} (${player.id}), isCurrentPlayer: ${isCurrentPlayer}`)
      if (videoElement.srcObject) {
        videoElement.srcObject = null
        streamRef.current = null
      }
    }

    // Update muted state if needed
    if (videoElement) {
      // Для текущего игрока всегда muted (чтобы не было эха)
      // Для других игроков применяем состояние isMuted
      videoElement.muted = isCurrentPlayer || isMuted
      
      // Также отключаем audio tracks, если игрок muted
      if (currentStream && !isCurrentPlayer) {
        const audioTracks = currentStream.getAudioTracks()
        audioTracks.forEach((track) => {
          track.enabled = !isMuted
        })
      }
    }

    // Cleanup function
    return () => {
      if (videoElement && videoElement.srcObject) {
        // Pause video and clear srcObject on cleanup
        videoElement.pause()
        videoElement.srcObject = null
      }
    }
  }, [
    player.stream,
    player.id,
    isCurrentPlayer,
    player.videoEnabled ?? false, // Use nullish coalescing to ensure stable value
    isMuted, // Добавляем isMuted в зависимости
  ]) // Ensure all dependencies are always defined to maintain stable array size

  // Get gender, age, profession from characteristics if revealed
  const genderChar = player.characteristics.find(c => c.category === 'gender' && c.isRevealed)
  const ageChar = player.characteristics.find(c => c.category === 'age' && c.isRevealed)
  const professionChar = player.characteristics.find(c => c.category === 'profession' && c.isRevealed)
  
  // Other revealed characteristics (excluding gender, age, profession)
  const revealedChars = player.characteristics.filter((c) => 
    c.isRevealed && !['gender', 'age', 'profession'].includes(c.category)
  )

  const handleCardClick = () => {
    onSelect?.()
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "relative h-full w-full min-h-0 rounded-sm border-2 overflow-hidden transition-all duration-300 cursor-pointer hover:brightness-105",
        "bg-[oklch(0.1_0.02_50/0.9)] backdrop-blur-sm",
        player.isEliminated && "card-eliminated",
        isCurrentPlayer ? "border-[oklch(0.7_0.15_200)] card-glow-cyan" : "border-[oklch(0.7_0.2_50)] card-glow-orange"
      )}
    >
      {/* Slot number */}
      <div className="absolute top-1 left-1 z-50 text-[oklch(0.5_0_0)] text-xs font-mono">{slotNumber}</div>

      {/* Video/Avatar area - для VDO.ninja занимает всю карточку */}
      {isCurrentPlayer && vdoNinjaCameraUrl ? (
        // Для VDO.ninja iframe занимает всю карточку
        <div
          className="absolute inset-0 w-full h-full z-0"
          onDragOver={handleDragOverInner}
          onDragLeave={handleDragLeaveInner}
          onDrop={handleDrop}
        >
          <iframe
            src={vdoNinjaCameraUrl}
            allow="camera; microphone; autoplay; fullscreen"
            className="w-full h-full border-0"
            style={{ 
              border: 'none',
              margin: 0,
              padding: 0,
              width: '100%',
              height: '100%',
              display: 'block'
            }}
            title="VDO.ninja Camera"
          />
        </div>
      ) : (
        <div
          className="relative w-full h-full min-h-0 bg-[oklch(0.08_0.01_60)] overflow-hidden"
          onDragOver={handleDragOverInner}
          onDragLeave={handleDragLeaveInner}
          onDrop={handleDrop}
        >
          {player.stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isCurrentPlayer}
              className="w-full h-full object-cover"
              onDragOver={handleDragOverInner}
              onDragLeave={handleDragLeaveInner}
              onDrop={handleDrop}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              onDragOver={handleDragOverInner}
              onDragLeave={handleDragLeaveInner}
              onDrop={handleDrop}
            >
              <User className="w-12 h-12 text-[oklch(0.3_0_0)]" />
            </div>
          )}

          {/* Video/Audio indicators - не показываем для VDO.ninja iframe */}
          {!(isCurrentPlayer && vdoNinjaCameraUrl) && (
            <div className="absolute bottom-1 right-1 flex gap-1 z-20">
              {!player.audioEnabled && (
                <div className="p-1 rounded bg-[oklch(0.55_0.22_25/0.8)]">
                  <MicOff className="w-3 h-3 text-foreground" />
                </div>
              )}
              {!player.videoEnabled && (
                <div className="p-1 rounded bg-[oklch(0.55_0.22_25/0.8)]">
                  <VideoOff className="w-3 h-3 text-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Characteristics overlay on video (when video is enabled and characteristics are shown) */}
          {showCharacteristics && player.videoEnabled && player.stream && revealedChars.length > 0 && (
            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.02_50/0.95)] via-transparent to-transparent pointer-events-none z-10">
              {/* Left side - first 5 characteristics */}
              <div className="absolute bottom-0 left-0 p-2 space-y-0.5 max-w-[60%]">
                {revealedChars.slice(0, 5).map((char, index) => (
                  <div
                    key={char.id}
                    className="text-[10px] leading-tight text-[oklch(0.85_0_0)] drop-shadow-lg truncate animate-in fade-in slide-in-from-bottom-2 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {char.value}
                  </div>
                ))}
              </div>
              {/* Right side - remaining characteristics */}
              {revealedChars.length > 5 && (
                <div className="absolute bottom-0 right-0 p-2 space-y-0.5 max-w-[60%] text-right">
                  {revealedChars.slice(5).map((char, index) => (
                    <div
                      key={char.id}
                      className="text-[10px] leading-tight text-[oklch(0.85_0_0)] drop-shadow-lg truncate animate-in fade-in slide-in-from-bottom-2 duration-500"
                      style={{ animationDelay: `${(index + 5) * 100}ms` }}
                    >
                      {char.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Characteristics overlay at bottom when video is disabled or no stream */}
          {showCharacteristics && (!player.videoEnabled || !player.stream) && revealedChars.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[oklch(0.08_0.02_50/0.95)] to-transparent pointer-events-none z-10">
              {/* Left side - first 5 characteristics */}
              <div className="absolute bottom-0 left-0 p-2 space-y-0.5 max-w-[60%]">
                {revealedChars.slice(0, 5).map((char, index) => (
                  <div
                    key={char.id}
                    className="text-[10px] leading-tight text-[oklch(0.85_0_0)] drop-shadow-lg truncate animate-in fade-in slide-in-from-bottom-2 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {char.value}
                  </div>
                ))}
              </div>
              {/* Right side - remaining characteristics */}
              {revealedChars.length > 5 && (
                <div className="absolute bottom-0 right-0 p-2 space-y-0.5 max-w-[60%] text-right">
                  {revealedChars.slice(5).map((char, index) => (
                    <div
                      key={char.id}
                      className="text-[10px] leading-tight text-[oklch(0.85_0_0)] drop-shadow-lg truncate animate-in fade-in slide-in-from-bottom-2 duration-500"
                      style={{ animationDelay: `${(index + 5) * 100}ms` }}
                    >
                      {char.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mute button for other players - show even for eliminated players */}
      {!isCurrentPlayer && onToggleMute && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
          className="absolute top-1 right-1 z-50 p-1.5 rounded bg-[oklch(0.15_0.02_50/0.9)] hover:bg-[oklch(0.2_0.02_50/0.95)] transition-colors"
          title={isMuted ? "Включить звук" : "Отключить звук"}
        >
          <MicOff className={`w-4 h-4 ${isMuted ? "text-destructive" : "text-muted-foreground"}`} />
        </button>
      )}

      {/* Player name overlay */}
      <div className="absolute top-1 left-6 right-1 z-50">
          {/* First line: Name with Gender and Age on the right */}
          <div className="flex items-start gap-1.5">
            <div className="flex flex-col items-start">
              <h3 className="text-sm font-bold text-foreground truncate drop-shadow-lg leading-tight">{player.name}</h3>
              {/* Profession directly under name, aligned with name - same position as on image */}
              {professionChar && (
                <div className="mt-0 leading-tight self-start">
                  <span className="text-[10px] font-semibold text-[oklch(0.7_0.2_50)] drop-shadow-lg">{professionChar.value}</span>
                </div>
              )}
            </div>
            {/* Gender and Age - right of name, aligned to top */}
            {(genderChar || ageChar) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {genderChar && (
                  <span className="text-[10px] font-bold text-[oklch(0.7_0.2_50)] drop-shadow-lg">{genderChar.value}</span>
                )}
                {ageChar && (
                  <span className="text-[10px] font-bold text-[oklch(0.7_0.2_50)] drop-shadow-lg">{ageChar.value}</span>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Show characteristics toggle when hidden */}
      {!showCharacteristics && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowCharacteristics(true)
          }}
          className="absolute bottom-1 left-1 z-50 p-1 rounded bg-[oklch(0.2_0.02_50/0.8)] text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Показать
        </button>
      )}

      {/* Camera effects overlay */}
      {activeEffects.map(({ id, effect }) => (
        <CameraEffectOverlay
          key={id}
          effect={effect}
          onComplete={() => onEffectComplete?.(id)}
        />
      ))}

      {/* Eliminated overlay - lower z-index so mute button is above */}
      {player.isEliminated && (
        <div className="absolute inset-0 bg-[oklch(0.55_0.22_25/0.3)] flex items-center justify-center z-40 pointer-events-none">
          <span className="text-[oklch(0.55_0.22_25)] font-bold text-lg rotate-[-15deg]">ВЫБЫЛ</span>
        </div>
      )}
    </div>
  )
}
