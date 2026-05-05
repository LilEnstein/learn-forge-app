import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import { signOutAndReturnToLogin } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This OAuth account is linked to a different user. Sign out of the current account and try again.",
  OAuthSignin: "Could not start the OAuth flow. Try again.",
  OAuthCallback: "OAuth provider rejected the sign-in. Try again.",
  AccessDenied: "Access denied. Try a different account.",
  Configuration: "Server auth configuration error. Contact support.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorCode = searchParams.error;
  const session = await getSession();

  if (session?.user?.id) {
    if (errorCode === "OAuthAccountNotLinked") {
      return (
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <CardTitle className="text-2xl font-bold">Account conflict</CardTitle>
            <CardDescription>
              You are signed in as <span className="font-medium">{session.user.email}</span>, but the
              OAuth account you tried to use is linked to a different user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={signOutAndReturnToLogin}>
              <Button type="submit" className="w-full">
                Sign out and switch account
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground">
              After signing out, you can log in with the other OAuth account.
            </p>
          </CardContent>
        </Card>
      );
    }
    redirect("/app/dashboard");
  }

  return <LoginForm initialError={errorCode ? ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Try again." : undefined} />;
}
