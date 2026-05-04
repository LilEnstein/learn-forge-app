import { CompanionChat } from "@/components/companion/CompanionChat";
import { requireSession } from "@/lib/auth/session";
import { getUserApiKeyStatus } from "@/app/actions/api-key";
import { hasEnvKey } from "@/lib/ai/user-provider";
import { NoAiKeyBanner } from "@/components/settings/NoAiKeyBanner";

export default async function CompanionPage() {
  const session = await requireSession();
  const keyStatus = await getUserApiKeyStatus();
  const showBanner = !keyStatus && !hasEnvKey(process.env.AI_PROVIDER ?? "gemini");

  return (
    <>
      <NoAiKeyBanner show={showBanner} />
      <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col border rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-violet-600 text-white flex-shrink-0">
          <span className="text-lg">🤖</span>
          <p className="font-semibold">AI Companion</p>
        </div>
        <CompanionChat context={{ type: "general" }} userId={session.user.id} />
      </div>
    </>
  );
}
