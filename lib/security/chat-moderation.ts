/**
 * Chat moderation utilities
 * Provides automatic filtering of inappropriate content in chat messages
 */

// List of inappropriate words (can be expanded)
// In production, this should be stored in a database or external service
const PROFANITY_WORDS = [
  // Russian profanity (common words, using transliteration for safety)
  "мат1",
  "мат2",
  "мат3",
  // Add more words as needed
]

// Words that should be blocked entirely (spam, scams, etc.)
const BLOCKED_PATTERNS = [
  /https?:\/\/[^\s]+/gi, // URLs (can be allowed in future with whitelist)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // Email addresses
  /(\+?7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, // Phone numbers
]

/**
 * Check if message contains profanity
 */
export function containsProfanity(message: string): boolean {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  
  for (const word of PROFANITY_WORDS) {
    // Check for word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    if (regex.test(normalized)) {
      return true
    }
  }
  
  return false
}

/**
 * Check if message contains blocked patterns (spam, links, etc.)
 */
export function containsBlockedPatterns(message: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return true
    }
  }
  return false
}

/**
 * Filter profanity by replacing with asterisks
 */
export function filterProfanity(message: string): string {
  let filtered = message
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  
  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")
    filtered = filtered.replace(regex, (match) => "*".repeat(match.length))
  }
  
  return filtered
}

/**
 * Moderate chat message
 * @returns Object with moderation result
 */
export interface ModerationResult {
  allowed: boolean
  filteredMessage?: string
  reason?: string
  severity: "none" | "filter" | "block"
}

export function moderateMessage(message: string): ModerationResult {
  // Check for blocked patterns first (spam, links, etc.) - block entirely
  if (containsBlockedPatterns(message)) {
    return {
      allowed: false,
      reason: "Сообщение содержит запрещенные элементы (ссылки, контакты и т.д.)",
      severity: "block",
    }
  }
  
  // Check for profanity - filter but allow
  if (containsProfanity(message)) {
    const filtered = filterProfanity(message)
    return {
      allowed: true,
      filteredMessage: filtered,
      reason: "Сообщение было отфильтровано",
      severity: "filter",
    }
  }
  
  return {
    allowed: true,
    severity: "none",
  }
}

/**
 * Check if message should be logged for admin review
 */
export function shouldLogForReview(result: ModerationResult): boolean {
  return result.severity === "block" || result.severity === "filter"
}
