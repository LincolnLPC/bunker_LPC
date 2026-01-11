"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export interface MediaSettings {
  autoRequestCamera: boolean
  autoRequestMicrophone: boolean
  defaultCameraEnabled: boolean
  defaultMicrophoneEnabled: boolean
  cameraDeviceId?: string | null
  microphoneDeviceId?: string | null
}

const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  autoRequestCamera: true,
  autoRequestMicrophone: true,
  defaultCameraEnabled: true,
  defaultMicrophoneEnabled: true,
}

export function useMediaSettings() {
  const [settings, setSettings] = useState<MediaSettings>(DEFAULT_MEDIA_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSettings(DEFAULT_MEDIA_SETTINGS)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("media_settings")
        .eq("id", user.id)
        .single()

      if (profile?.media_settings) {
        setSettings({
          autoRequestCamera: profile.media_settings.autoRequestCamera ?? DEFAULT_MEDIA_SETTINGS.autoRequestCamera,
          autoRequestMicrophone:
            profile.media_settings.autoRequestMicrophone ?? DEFAULT_MEDIA_SETTINGS.autoRequestMicrophone,
          defaultCameraEnabled:
            profile.media_settings.defaultCameraEnabled ?? DEFAULT_MEDIA_SETTINGS.defaultCameraEnabled,
          defaultMicrophoneEnabled:
            profile.media_settings.defaultMicrophoneEnabled ?? DEFAULT_MEDIA_SETTINGS.defaultMicrophoneEnabled,
          cameraDeviceId: profile.media_settings.cameraDeviceId ?? null,
          microphoneDeviceId: profile.media_settings.microphoneDeviceId ?? null,
        })
      } else {
        setSettings(DEFAULT_MEDIA_SETTINGS)
      }

      setLoading(false)
    }

    loadSettings()
  }, [])

  return { settings, loading }
}
