/**
 * Простой кэш для fetch-запросов с TTL.
 * Снижает повторные запросы к API для редко меняющихся данных.
 */
const cache = new Map<string, { data: unknown; expiresAt: number }>()

const DEFAULT_TTL_MS = 60_000 // 1 минута

export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const key = `${url}:${JSON.stringify(options?.method ?? "GET")}`
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as T
  }
  const response = await fetch(url, options)
  const data = (await response.json()) as T
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error ?? `Request failed: ${response.status}`)
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
  return data
}

/** Инвалидировать кэш по URL (например, после создания/удаления шаблона) */
export function invalidateCache(urlPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key)
  }
}
