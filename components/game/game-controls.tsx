"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Hand, Vote, SkipForward, CheckCircle, Sparkles, Home, Settings2, Camera, FileText, Volume2, VolumeX, BarChart3 } from "lucide-react"

interface GameControlsProps {
  isHost: boolean
  currentPhase: "waiting" | "playing" | "voting" | "results" | "finished"
  onToggleMic?: () => void
  onToggleVideo?: () => void
  onRevealCharacteristic?: () => void
  onViewMyCharacteristics?: () => void
  onStartVoting?: () => void
  onNextRound?: () => void
  onEndVoting?: () => void
  onOpenSpecialCards?: () => void
  onOpenBunkerInfo?: () => void
  onOpenCharacteristicsManager?: () => void
  onRequestMedia?: () => void
  audioEnabled?: boolean
  videoEnabled?: boolean
  hasLocalStream?: boolean
  allPlayersMuted?: boolean
  onToggleAllPlayersMute?: () => void
  roundMode?: "manual" | "automatic"
  onOpenVoteCounts?: () => void
}

export function GameControls({
  isHost,
  currentPhase,
  onToggleMic,
  onToggleVideo,
  onRevealCharacteristic,
  onViewMyCharacteristics,
  onStartVoting,
  onNextRound,
  onEndVoting,
  onOpenSpecialCards,
  onOpenBunkerInfo,
  onOpenCharacteristicsManager,
  onRequestMedia,
  audioEnabled = true,
  videoEnabled = true,
  hasLocalStream = false,
  allPlayersMuted = false,
  onToggleAllPlayersMute,
  roundMode = "automatic",
  onOpenVoteCounts,
}: GameControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[oklch(0.08_0.01_60/0.95)] border-t border-border backdrop-blur-sm">
      <div className="flex items-center justify-center gap-3 p-3">
        {/* Media controls */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[oklch(0.12_0.01_60)] rounded-lg">
          {!hasLocalStream && onRequestMedia && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={onRequestMedia}
            >
              <Camera className="w-4 h-4 mr-2" />
              Включить камеру
            </Button>
          )}
          {hasLocalStream && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={audioEnabled ? "text-foreground" : "text-destructive"}
                onClick={onToggleMic}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={videoEnabled ? "text-foreground" : "text-destructive"}
                onClick={onToggleVideo}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </>
          )}
          {/* Mute all players button */}
          {onToggleAllPlayersMute && (
            <Button
              variant="ghost"
              size="icon"
              className={allPlayersMuted ? "text-destructive" : "text-foreground"}
              onClick={onToggleAllPlayersMute}
              title={allPlayersMuted ? "Включить звук всех игроков" : "Отключить звук всех игроков"}
            >
              {allPlayersMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
          )}
        </div>

        {/* Game actions */}
        {currentPhase === "playing" && (
          <>
            {onViewMyCharacteristics && (
              <Button
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                onClick={onViewMyCharacteristics}
              >
                <FileText className="w-4 h-4 mr-2" />
                Мои характеристики
              </Button>
            )}

            <Button
              variant="outline"
              className="border-purple-500 text-purple-400 hover:bg-purple-500/10 bg-transparent"
              onClick={onOpenSpecialCards}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Спец. карты
            </Button>

            <Button
              variant="outline"
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 bg-transparent"
              onClick={onOpenBunkerInfo}
            >
              <Home className="w-4 h-4 mr-2" />
              Бункер
            </Button>

            {isHost && (
              <>
                <Button
                  variant="outline"
                  className="border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                  onClick={onOpenCharacteristicsManager}
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Управление
                </Button>
                <Button
                  variant="default"
                  className="bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] hover:bg-[oklch(0.75_0.22_50)]"
                  onClick={onStartVoting}
                >
                  <Vote className="w-4 h-4 mr-2" />
                  Начать голосование
                </Button>
              </>
            )}
          </>
        )}

        {currentPhase === "voting" && (
          <>
            <div className="text-sm text-[oklch(0.7_0.2_50)] animate-pulse">Идёт голосование...</div>
            {onOpenVoteCounts && (
              <Button
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                onClick={onOpenVoteCounts}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Голоса
              </Button>
            )}
            {isHost && onOpenCharacteristicsManager && (
              <Button
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10 bg-transparent"
                onClick={onOpenCharacteristicsManager}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Управление
              </Button>
            )}
            {isHost && roundMode === "automatic" && (
              <Button
                variant="outline"
                className="border-[oklch(0.7_0.2_50)] text-[oklch(0.7_0.2_50)] hover:bg-[oklch(0.7_0.2_50/0.1)] bg-transparent"
                onClick={onEndVoting}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Завершить голосование
              </Button>
            )}
            {isHost && roundMode === "manual" && onNextRound && (
              <Button
                variant="default"
                className="bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] hover:bg-[oklch(0.75_0.22_50)]"
                onClick={onNextRound}
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Следующий раунд
              </Button>
            )}
          </>
        )}

        {currentPhase === "results" && isHost && (
          <Button
            variant="default"
            className="bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] hover:bg-[oklch(0.75_0.22_50)]"
            onClick={onNextRound}
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Следующий раунд
          </Button>
        )}
      </div>
    </div>
  )
}
