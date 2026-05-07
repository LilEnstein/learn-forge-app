"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";

export interface MapLesson {
  id: string;
  title: string;
  type: "standard" | "checkpoint";
  order: number;
  xpReward: number;
  exerciseCount: number;
  status: "locked" | "available" | "completed";
  chapterId: string;
  chapterTitle: string;
}

interface Props {
  lesson: MapLesson;
  side: "left" | "right";
  onClick: (lesson: MapLesson) => void;
}

const NODE_SIZE = 56;

export function MapNode({ lesson, side, onClick }: Props) {
  const { status, type } = lesson;
  const isCheckpoint = type === "checkpoint";
  const isLocked = status === "locked";
  const isAvailable = status === "available";
  const isCompleted = status === "completed";

  // Pulse animation only when available
  const pulseAnimate = isAvailable
    ? isCheckpoint
      ? {
          boxShadow: [
            "0 0 0 0 rgba(245,158,11,0.7)",
            "0 0 0 12px rgba(245,158,11,0)",
            "0 0 0 0 rgba(245,158,11,0)",
          ],
        }
      : {
          boxShadow: [
            "0 0 0 0 rgba(124,58,237,0.5)",
            "0 0 0 12px rgba(124,58,237,0)",
            "0 0 0 0 rgba(124,58,237,0)",
          ],
        }
    : {};

  const nodeBackground = isLocked
    ? "#e5e7eb"
    : isCheckpoint
    ? isCompleted
      ? "#FCD34D" // fallback gold; checkpoint-shimmer CSS will animate it
      : "linear-gradient(135deg, #F59E0B, #D97706)"
    : "#7c3aed";

  const nodeStyle: CSSProperties = {
    width: NODE_SIZE,
    height: NODE_SIZE,
    background: nodeBackground,
    ...(isCheckpoint
      ? { clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }
      : { borderRadius: "50%" }),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    cursor: isLocked ? "default" : "pointer",
    flexShrink: 0,
    position: "relative",
  };

  // Shimmer class applied to completed checkpoint nodes (CSS defined in globals.css)
  const shimmerClass = isCheckpoint && isCompleted ? "checkpoint-shimmer" : "";

  const icon = isLocked ? "🔒" : isCompleted ? (isCheckpoint ? "⭐" : "✓") : isCheckpoint ? "🏆" : "📘";

  return (
    <div
      id={`map-node-${lesson.id}`}
      className={`flex ${side === "right" ? "justify-end pr-8" : "justify-start pl-8"}`}
    >
      <div className="relative group">
        {/* XP badge — checkpoint only, visible when not locked */}
        {isCheckpoint && !isLocked && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-amber-600 whitespace-nowrap">
            +{lesson.xpReward} XP
          </div>
        )}

        <motion.div
          className={shimmerClass}
          style={nodeStyle}
          role="button"
          aria-disabled={isLocked ? "true" : undefined}
          aria-label={
            isLocked
              ? `${lesson.title} — locked`
              : isCompleted
              ? `${lesson.title} — completed`
              : `${lesson.title} — ${lesson.xpReward} XP — available`
          }
          title={isLocked ? "Hoàn thành bài trước để mở khóa" : undefined}
          animate={{
            opacity: isLocked ? 0.4 : 1,
            scale: isLocked ? 0.9 : 1,
            ...pulseAnimate,
          }}
          transition={
            isAvailable
              ? { boxShadow: { duration: 2, repeat: Infinity }, opacity: { duration: 0.4 }, scale: { duration: 0.4 } }
              : { duration: 0.4 }
          }
          onClick={() => !isLocked && onClick(lesson)}
          whileHover={!isLocked ? { scale: 1.08 } : undefined}
        >
          <span style={{ color: isLocked ? "#9ca3af" : "white", fontSize: isCompleted && !isCheckpoint ? 20 : 22 }}>
            {icon}
          </span>
        </motion.div>

        {isLocked && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            aria-hidden="true"
          >
            Hoàn thành bài trước để mở khóa
          </div>
        )}
      </div>
    </div>
  );
}
