/**
 * Connection recovery utilities
 * Handles retry logic and connection state recovery
 */

export interface RetryOptions {
  maxAttempts?: number
  delay?: number // milliseconds
  backoff?: boolean // exponential backoff
  onRetry?: (attempt: number) => void
  shouldRetry?: (error: any) => boolean
}

/**
 * Retry a function with configurable options
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = true,
    onRetry,
    shouldRetry = () => true,
  } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error
      }

      // If this is the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw error
      }

      // Call retry callback
      onRetry?.(attempt)

      // Calculate delay with optional exponential backoff
      const currentDelay = backoff ? delay * Math.pow(2, attempt - 1) : delay
      await new Promise((resolve) => setTimeout(resolve, currentDelay))
    }
  }

  throw lastError
}

/**
 * Check if error is a network error that can be retried
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false

  // Network errors
  if (error.message?.includes("fetch") || error.message?.includes("network")) {
    return true
  }

  // Timeout errors
  if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
    return true
  }

  // HTTP 5xx errors (server errors) are retryable
  if (error.status >= 500 && error.status < 600) {
    return true
  }

  // HTTP 429 (rate limit) is retryable
  if (error.status === 429) {
    return true
  }

  // HTTP 408 (request timeout) is retryable
  if (error.status === 408) {
    return true
  }

  return false
}

/**
 * Check if error is a connection error
 */
export function isConnectionError(error: any): boolean {
  if (!error) return false

  return (
    error.message?.includes("connection") ||
    error.message?.includes("disconnected") ||
    error.message?.includes("network") ||
    error.name === "NetworkError" ||
    error.name === "AbortError"
  )
}

/**
 * Handle media device errors
 */
export function handleMediaError(error: any): { message: string; recoverable: boolean } {
  if (!error) {
    return { message: "Неизвестная ошибка медиа", recoverable: false }
  }

  if (error instanceof Error) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return {
          message: "Доступ к камере/микрофону запрещен. Разрешите доступ в настройках браузера.",
          recoverable: true,
        }
      case "NotFoundError":
      case "DevicesNotFoundError":
        return {
          message: "Камера или микрофон не найдены. Убедитесь, что устройства подключены.",
          recoverable: true,
        }
      case "NotReadableError":
      case "TrackStartError":
        return {
          message: "Камера или микрофон уже используются другим приложением.",
          recoverable: true,
        }
      case "OverconstrainedError":
        return {
          message: "Устройство не поддерживает запрошенные параметры.",
          recoverable: true,
        }
      case "TypeError":
        return {
          message: "Браузер не поддерживает доступ к медиа устройствам.",
          recoverable: false,
        }
      default:
        return {
          message: error.message || "Ошибка доступа к медиа устройствам",
          recoverable: true,
        }
    }
  }

  return { message: "Неизвестная ошибка", recoverable: false }
}
