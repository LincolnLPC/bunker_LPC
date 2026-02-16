/**
 * Zod-схемы для валидации ответов API игры (join, start, vote).
 * Используются для безопасного парсинга и типизации ответов.
 */
import { z } from "zod"

const playerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().optional(),
}).passthrough()

export const joinResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  requiresPassword: z.boolean().optional(),
  hostOnly: z.boolean().optional(),
  isSpectator: z.boolean().optional(),
  spectatorId: z.string().uuid().optional(),
  isExisting: z.boolean().optional(),
  player: playerSchema.optional(),
  characteristicsCount: z.number().optional(),
}).passthrough()

export const startResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
}).passthrough()

const voteSchema = z.object({
  id: z.string().optional(),
  room_id: z.string().optional(),
  round: z.number().optional(),
  voter_id: z.string().optional(),
  target_id: z.string().optional(),
  vote_weight: z.number().optional(),
}).passthrough()

export const voteResponseSchema = z.object({
  success: z.boolean().optional(),
  vote: voteSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
}).passthrough()

export type JoinResponse = z.infer<typeof joinResponseSchema>
export type StartResponse = z.infer<typeof startResponseSchema>
export type VoteResponse = z.infer<typeof voteResponseSchema>
