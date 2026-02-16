"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { mediaLog } from "@/lib/media-logger"

export interface MediaSettings {
  autoRequestCamera: boolean
  autoRequestMicrophone: boolean
  defaultCameraEnabled: boolean
  defaultMicrophoneEnabled: boolean
  cameraDeviceId?: string | null
  microphoneDeviceId?: string | null
  vdoNinjaCameraUrl?: string | null
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
        const s = {
          autoRequestCamera: profile.media_settings.autoRequestCamera ?? DEFAULT_MEDIA_SETTINGS.autoRequestCamera,
          autoRequestMicrophone:
            profile.media_settings.autoRequestMicrophone ?? DEFAULT_MEDIA_SETTINGS.autoRequestMicrophone,
          defaultCameraEnabled:
            profile.media_settings.defaultCameraEnabled ?? DEFAULT_MEDIA_SETTINGS.defaultCameraEnabled,
          defaultMicrophoneEnabled:
            profile.media_settings.defaultMicrophoneEnabled ?? DEFAULT_MEDIA_SETTINGS.defaultMicrophoneEnabled,
          cameraDeviceId: profile.media_settings.cameraDeviceId ?? null,
          microphoneDeviceId: profile.media_settings.microphoneDeviceId ?? null,
          vdoNinjaCameraUrl: profile.media_settings.vdoNinjaCameraUrl ?? null,
        }
        setSettings(s)
        mediaLog.settingsLoaded({
          autoCamera: s.autoRequestCamera,
          autoMic: s.autoRequestMicrophone,
          defaultCameraOn: s.defaultCameraEnabled,
          defaultMicOn: s.defaultMicrophoneEnabled,
          hasVdoNinja: !!s.vdoNinjaCameraUrl,
          cameraDeviceId: s.cameraDeviceId ?? null,
          microphoneDeviceId: s.microphoneDeviceId ?? null,
        })
      } else {
        setSettings(DEFAULT_MEDIA_SETTINGS)
        mediaLog.settingsLoaded({
          autoCamera: DEFAULT_MEDIA_SETTINGS.autoRequestCamera,
          autoMic: DEFAULT_MEDIA_SETTINGS.autoRequestMicrophone,
          defaultCameraOn: DEFAULT_MEDIA_SETTINGS.defaultCameraEnabled,
          defaultMicOn: DEFAULT_MEDIA_SETTINGS.defaultMicrophoneEnabled,
          hasVdoNinja: false,
          cameraDeviceId: null,
          microphoneDeviceId: null,
        })
      }

      setLoading(false)
    }

    loadSettings()
  }, [])

  return { settings, loading }
}
