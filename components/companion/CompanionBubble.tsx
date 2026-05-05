"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { CompanionChat } from "./CompanionChat";
import { useCompanionContext } from "@/lib/companion/useCompanionContext";

interface Props {
  userId?: string;
}

export function CompanionBubble({ userId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const context = useCompanionContext();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-80 h-[480px] bg-card border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-violet-600 text-white flex-shrink-0">
              <span className="text-lg">🤖</span>
              <p className="font-semibold text-sm flex-1">AI Companion</p>
              <button onClick={() => setIsOpen(false)} aria-label="Close companion">
                <X className="h-4 w-4 opacity-80 hover:opacity-100" />
              </button>
            </div>
            <CompanionChat context={context} userId={userId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble button */}
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close AI Companion" : "Open AI Companion"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
