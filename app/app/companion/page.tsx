import { CompanionChat } from "@/components/companion/CompanionChat";

export default function CompanionPage() {
  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-violet-600 text-white flex-shrink-0">
        <span className="text-lg">🤖</span>
        <p className="font-semibold">AI Companion</p>
      </div>
      <CompanionChat context={{ type: "general" }} />
    </div>
  );
}
