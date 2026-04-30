"use client";

import { useEffect, useState } from "react";
import { useGamification } from "./useGamification";

export function useHearts() {
  const { data } = useGamification();
  const [timeToRefill, setTimeToRefill] = useState<string>("");

  useEffect(() => {
    if (!data?.nextRefillAt) {
      setTimeToRefill("");
      return;
    }
    const update = () => {
      const ms = new Date(data.nextRefillAt!).getTime() - Date.now();
      if (ms <= 0) {
        setTimeToRefill("");
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTimeToRefill(`${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [data?.nextRefillAt]);

  return {
    hearts: data?.hearts ?? 5,
    maxHearts: data?.maxHearts ?? 5,
    timeToRefill,
  };
}
