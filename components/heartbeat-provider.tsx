"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await fetch("/api/profile/heartbeat", { method: "POST" })
      } catch {
        // ignore
      }
    }

    run()
    intervalRef.current = setInterval(run, HEARTBEAT_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return <>{children}</>
}
