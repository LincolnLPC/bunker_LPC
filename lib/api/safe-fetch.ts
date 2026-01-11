/**
 * Safe fetch utilities with better error handling
 */

export interface SafeFetchResult<T = any> {
  success: boolean
  data?: T
  error?: string
  status?: number
  statusText?: string
}

/**
 * Safely parse JSON from response
 */
export async function safeJsonParse<T = any>(response: Response): Promise<SafeFetchResult<T>> {
  try {
    const contentType = response.headers.get("content-type")
    
    if (!contentType || !contentType.includes("application/json")) {
      return {
        success: false,
        error: `Expected JSON but got ${contentType || "unknown"}`,
        status: response.status,
        statusText: response.statusText,
      }
    }

    const text = await response.text()
    
    if (!text || !text.trim()) {
      return {
        success: false,
        error: "Empty response body",
        status: response.status,
        statusText: response.statusText,
      }
    }

    try {
      const data = JSON.parse(text) as T
      return {
        success: true,
        data,
        status: response.status,
        statusText: response.statusText,
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Response text:", text.substring(0, 200))
      return {
        success: false,
        error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        status: response.status,
        statusText: response.statusText,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error reading response",
      status: response.status,
      statusText: response.statusText,
    }
  }
}

/**
 * Safe fetch with automatic JSON parsing and error handling
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, options)
    
    const result = await safeJsonParse<T>(response)
    
    if (!response.ok) {
      return {
        ...result,
        success: false,
        error: result.error || result.data?.error || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        statusText: response.statusText,
      }
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}
