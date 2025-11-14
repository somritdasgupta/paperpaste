"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
  onDetected: (text: string) => void
}

export function QRScanner({ isOpen, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const hasDetector =
        typeof window !== "undefined" &&
        "BarcodeDetector" in window &&
        typeof (window as any).BarcodeDetector === "function"

      if (hasDetector) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
        const detectLoop = async () => {
          if (!videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            const qr = barcodes?.[0]?.rawValue
            if (qr) {
              onDetected(qr)
              return
            }
          } catch {
            // ignore and keep scanning
          }
          frameRef.current = requestAnimationFrame(detectLoop)
        }
        frameRef.current = requestAnimationFrame(detectLoop)
      } else {
        setError("Live QR scanning not supported on this device. Try Image Scan below.")
      }
    } catch (e: any) {
      setError(e?.message || "Camera access denied")
    }
  }, [onDetected])

  useEffect(() => {
    if (isOpen) {
      start()
      return () => stop()
    } else {
      stop()
    }
  }, [isOpen, start, stop])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-background text-foreground rounded-sm shadow-lg overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Scan QR</h2>
          <button
            className="text-sm underline underline-offset-4 hover:opacity-80"
            onClick={() => {
              stop()
              onClose()
            }}
          >
            Close
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div className="aspect-square w-full bg-black rounded-sm overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              crossOrigin="anonymous"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Point your camera at the QR code. Detection happens automatically.
            </p>
          )}

          {typeof window !== "undefined" && !("BarcodeDetector" in window) && (
            <ImageScanFallback onDetected={onDetected} />
          )}
        </div>
      </div>
    </div>
  )
}

function ImageScanFallback({ onDetected }: { onDetected: (text: string) => void }) {
  const [err, setErr] = useState<string | null>(null)

  const onFile = async (file: File) => {
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = async () => {
        try {
          if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
            const codes = await detector.detect(img)
            const qr = (codes?.[0] as any)?.rawValue
            if (qr) onDetected(qr)
            else setErr("No QR code found in image.")
          } else {
            setErr("QR detection not supported on this device.")
          }
        } catch {
          setErr("Unable to detect QR from image.")
        }
      }
      img.src = URL.createObjectURL(file)
    } catch {
      setErr("Unable to read selected image.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">Image Scan (fallback)</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
        className="text-sm"
      />
      {err && <div className="text-sm text-red-500">{err}</div>}
    </div>
  )
}
