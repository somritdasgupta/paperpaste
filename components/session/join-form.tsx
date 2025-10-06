"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function randomCode(): string {
  // 7-digit numeric code
  return Math.floor(1000000 + Math.random() * 9000000).toString()
}

export default function JoinForm() {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", "", ""])
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const cleanedJoin = () => digits.join("").replace(/\D/g, "").slice(0, 7)

  const onJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = cleanedJoin()
    if (cleaned.length === 7) {
      router.push(`/session/${cleaned}`)
    }
  }

  const onCreate = () => {
    const newCode = randomCode()
    router.push(`/session/${newCode}?new=1`)
  }

  const setDigit = (index: number, val: string) => {
    const v = (val || "").replace(/\D/g, "").slice(0, 1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = v
      return next
    })
  }

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault()
      refs.current[index - 1]?.focus()
      setDigit(index - 1, "")
      return
    }
    if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus()
      return
    }
    if (e.key === "ArrowRight" && index < 6) {
      refs.current[index + 1]?.focus()
      return
    }
  }

  const onChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "")
    if (v.length === 0) {
      setDigit(index, "")
      return
    }
    const chars = v.slice(0, 7 - index).split("")
    setDigits((prev) => {
      const next = [...prev]
      for (let i = 0; i < chars.length; i++) {
        const pos = index + i
        if (pos < 7) next[pos] = chars[i]
      }
      return next
    })
    const nextIndex = Math.min(index + chars.length, 6)
    refs.current[nextIndex]?.focus()
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text") || ""
    const cleaned = text.replace(/\D/g, "").slice(0, 7).split("")
    if (cleaned.length) {
      e.preventDefault()
      setDigits((prev) => {
        const next = [...prev]
        for (let i = 0; i < 7; i++) next[i] = cleaned[i] || ""
        return next
      })
      refs.current[Math.min(cleaned.length, 6)]?.focus()
    }
  }

  useEffect(() => {
    // auto submit when all 7 digits filled
    const val = cleanedJoin()
    if (val.length === 7) {
      router.push(`/session/${val}`)
    }
  }, [digits]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form onSubmit={onJoin} className="flex flex-col gap-4 sm:gap-6">
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            onKeyDown={(e) => onKeyDown(i, e)}
            onChange={(e) => onChange(i, e)}
            onPaste={onPaste}
            aria-label={`Digit ${i + 1}`}
            className={cn("h-12 sm:h-14 text-2xl sm:text-3xl text-center font-bold tracking-widest", "w-full")}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
        <Button type="submit" variant="default" className="w-full sm:w-auto">
          Get in
        </Button>
        <Button type="button" variant="secondary" onClick={onCreate} className="w-full sm:w-auto">
          Create new session
        </Button>
      </div>
    </form>
  )
}
