"use client"

import { useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { GameState, Player, ChatMessage, Vote } from "@/types/game"

interface UseRealtimeGameProps {
  roomId: string
  onGameStateUpdate?: (state: Partial<GameState>) => void
  onPlayerJoin?: (player: Player) => void
  onPlayerLeave?: (playerId: string) => void
  onChatMessage?: (message: ChatMessage) => void
  onVoteCast?: (vote: Vote) => void
  onCharacteristicReveal?: (playerId: string, characteristicId: string) => void
}

export function useRealtimeGame({
  roomId,
  onGameStateUpdate,
  onPlayerJoin,
  onPlayerLeave,
  onChatMessage,
  onVoteCast,
  onCharacteristicReveal,
}: UseRealtimeGameProps) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!roomId) return

    // Subscribe to room channel
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: roomId },
      },
    })

    // Listen for game state updates
    channel.on("broadcast", { event: "game_state" }, ({ payload }) => {
      onGameStateUpdate?.(payload as Partial<GameState>)
    })

    // Listen for player join
    channel.on("broadcast", { event: "player_join" }, ({ payload }) => {
      onPlayerJoin?.(payload as Player)
    })

    // Listen for player leave
    channel.on("broadcast", { event: "player_leave" }, ({ payload }) => {
      onPlayerLeave?.(payload.playerId as string)
    })

    // Listen for chat messages
    channel.on("broadcast", { event: "chat_message" }, ({ payload }) => {
      onChatMessage?.(payload as ChatMessage)
    })

    // Listen for votes
    channel.on("broadcast", { event: "vote_cast" }, ({ payload }) => {
      onVoteCast?.(payload as Vote)
    })

    // Listen for characteristic reveals
    channel.on("broadcast", { event: "characteristic_reveal" }, ({ payload }) => {
      onCharacteristicReveal?.(payload.playerId as string, payload.characteristicId as string)
    })

    // Subscribe to presence for player online status
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState()
      console.log("[v0] Presence state:", state)
    })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log("[v0] Subscribed to room channel:", roomId)
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [
    roomId,
    onGameStateUpdate,
    onPlayerJoin,
    onPlayerLeave,
    onChatMessage,
    onVoteCast,
    onCharacteristicReveal,
    supabase,
  ])

  // Broadcast game state update
  const broadcastGameState = useCallback(async (state: Partial<GameState>) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: "broadcast",
      event: "game_state",
      payload: state,
    })
  }, [])

  // Broadcast chat message
  const broadcastChatMessage = useCallback(async (message: ChatMessage) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: "broadcast",
      event: "chat_message",
      payload: message,
    })
  }, [])

  // Broadcast vote
  const broadcastVote = useCallback(async (vote: Vote) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: "broadcast",
      event: "vote_cast",
      payload: vote,
    })
  }, [])

  // Broadcast characteristic reveal
  const broadcastCharacteristicReveal = useCallback(async (playerId: string, characteristicId: string) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: "broadcast",
      event: "characteristic_reveal",
      payload: { playerId, characteristicId },
    })
  }, [])

  // Track presence
  const trackPresence = useCallback(async (playerData: { id: string; name: string }) => {
    if (!channelRef.current) return
    await channelRef.current.track(playerData)
  }, [])

  return {
    broadcastGameState,
    broadcastChatMessage,
    broadcastVote,
    broadcastCharacteristicReveal,
    trackPresence,
  }
}
