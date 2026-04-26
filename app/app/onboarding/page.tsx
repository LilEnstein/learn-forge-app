"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Mascot, MASCOT_META, type AvatarKey } from "@/components/mascots/Mascot";

const TOPICS = [
  { key: "python", emoji: "🐍", label: "Python" },
  { key: "javascript", emoji: "⚡", label: "JavaScript" },
  { key: "english", emoji: "🇬🇧", label: "English" },
  { key: "sql", emoji: "🗄️", label: "SQL" },
  { key: "math", emoji: "📐", label: "Math" },
  { key: "history", emoji: "📜", label: "History" },
  { key: "science", emoji: "🔬", label: "Science" },
  { key: "custom", emoji: "✨", label: "Custom" },
];

const GOALS = [
  { minutes: 5, label: "Casual", description: "5 min / day" },
  { minutes: 10, label: "Regular", description: "10 min / day" },
  { minutes: 15, label: "Serious", description: "15 min / day" },
];

const AVATARS = (Object.keys(MASCOT_META) as AvatarKey[]).map((key) => ({
  key,
  ...MASCOT_META[key],
}));

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState<string | null>(null);
  const [goal, setGoal] = useState<number>(10);
  const [avatar, setAvatar] = useState<string>("owl");
  const [saving, setSaving] = useState(false);

  const steps = ["Choose a topic", "Set your goal", "Pick your mascot"];

  async function finish() {
    setSaving(true);
    await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, dailyGoalMin: goal, avatarKey: avatar }),
    });
    router.push("/app/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-4">
      <div className="w-full max-w-lg">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("h-0.5 w-12", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0 — Topic */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <Card className="shadow-xl">
                <CardContent className="pt-8 pb-6 space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">What do you want to learn?</h2>
                    <p className="text-muted-foreground mt-1">You can always add more later</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {TOPICS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTopic(t.key)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-medium transition-colors border-2",
                          topic === t.key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent bg-muted hover:bg-accent"
                        )}
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <span className="text-xs">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={!topic}
                    onClick={() => setStep(1)}
                  >
                    Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 1 — Daily goal */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <Card className="shadow-xl">
                <CardContent className="pt-8 pb-6 space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Set your daily goal</h2>
                    <p className="text-muted-foreground mt-1">Consistency beats intensity</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {GOALS.map((g) => (
                      <button
                        key={g.minutes}
                        onClick={() => setGoal(g.minutes)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-5 py-4 border-2 transition-colors font-medium",
                          goal === g.minutes
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <span className="text-lg">{g.label}</span>
                        <span className="text-sm text-muted-foreground">{g.description}</span>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => setStep(2)}>
                    Continue <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2 — Avatar */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <Card className="shadow-xl">
                <CardContent className="pt-8 pb-6 space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">Pick your mascot</h2>
                    <p className="text-muted-foreground mt-1">They&apos;ll cheer you on every lesson</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {AVATARS.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setAvatar(a.key)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl p-3 border-2 transition-all",
                          avatar === a.key
                            ? "border-primary bg-primary/10 scale-105 shadow-md"
                            : "border-transparent bg-muted hover:bg-accent hover:scale-102"
                        )}
                      >
                        <Mascot avatarKey={a.key} size={72} />
                        <span className="text-xs font-medium text-center leading-tight">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full" onClick={finish} disabled={saving}>
                    {saving ? "Saving…" : "Let's go! 🚀"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
