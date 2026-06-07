"use client"

import { useEffect } from "react"
import { useMascot } from "@/hooks/useMascot"
import { MascotFloat } from "@/components/mascot/MascotFloat"

interface Props {
  currentStreak: number
  streakWarning: boolean
  streakMilestone: boolean
}

const WELCOMED_KEY = "lf_mascot_welcomed"

export function DashboardMascot({ currentStreak, streakWarning, streakMilestone }: Props) {
  const { react, show, setMessage } = useMascot()

  useEffect(() => {
    const neverWelcomed = !localStorage.getItem(WELCOMED_KEY)

    if (neverWelcomed) {
      react("welcome")
      localStorage.setItem(WELCOMED_KEY, "1")
    } else if (streakWarning) {
      react("streak_warning")
    } else if (streakMilestone) {
      react("streak_milestone")
      setMessage(`🔥 ${currentStreak} ngày liên tiếp! Tuyệt vời!`)
    } else {
      show("three-quarter")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <MascotFloat position="bottom-right" />
}
