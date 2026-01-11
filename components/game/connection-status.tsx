"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, AlertCircle, RefreshCw, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConnectionStatusProps {
  isConnected: boolean
  isReconnecting?: boolean
  onRetry?: () => void
  className?: string
}

export function ConnectionStatus({
  isConnected,
  isReconnecting = false,
  onRetry,
  className,
}: ConnectionStatusProps) {
  const [show, setShow] = useState(!isConnected)

  useEffect(() => {
    // Show alert if disconnected, hide if connected for 3 seconds
    if (!isConnected) {
      setShow(true)
    } else {
      const timer = setTimeout(() => {
        setShow(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isConnected])

  if (!show && isConnected) return null

  return (
    <Alert
      className={cn(
        "fixed top-4 right-4 z-50 max-w-md border-2 shadow-lg",
        isConnected
          ? "bg-green-500/10 border-green-500/50 text-green-500"
          : "bg-destructive/10 border-destructive/50 text-destructive",
        className
      )}
    >
      {isConnected ? (
        <>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Соединение восстановлено</AlertTitle>
          <AlertDescription>Связь с сервером восстановлена</AlertDescription>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Потеряно соединение</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>
              {isReconnecting ? "Попытка переподключения..." : "Нет соединения с сервером"}
            </span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isReconnecting}
                className="ml-2"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", isReconnecting && "animate-spin")} />
                Повторить
              </Button>
            )}
          </AlertDescription>
        </>
      )}
    </Alert>
  )
}

interface OnlineStatusProps {
  className?: string
}

export function OnlineStatus({ className }: OnlineStatusProps) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [showOffline, setShowOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOffline(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <Alert
      className={cn(
        "fixed bottom-4 left-4 z-50 max-w-sm border-2 shadow-lg bg-destructive/10 border-destructive/50 text-destructive",
        className
      )}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Нет интернет-соединения</AlertTitle>
      <AlertDescription>Проверьте подключение к интернету</AlertDescription>
    </Alert>
  )
}
