import { MessageCircle } from "lucide-react";

export default function CompanionPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="rounded-full bg-muted p-6">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">AI Companion</h1>
      <p className="text-muted-foreground">Coming soon — your AI study buddy is on the way.</p>
    </div>
  );
}
