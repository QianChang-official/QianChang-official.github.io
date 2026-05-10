import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 z-0">
        <img src="/assets/hero-bg.jpg" alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--flux-marble)] via-[var(--flux-marble)]/80 to-[var(--flux-marble)]" />
      </div>
      <Card className="w-full max-w-sm relative z-10 bg-[var(--flux-marble-dark)]/80 border-[var(--flux-line)] backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <h1 className="text-2xl font-black gold-gradient-text mb-2">流境</h1>
          <CardTitle className="text-[var(--flux-ink)] text-lg">域管理后台</CardTitle>
          <p className="text-sm text-[var(--flux-ink-light)] mt-1">登录以管理您的数字疆域</p>
        </CardHeader>
        <CardContent className="pt-4">
          <Button
            className="w-full btn-gold flex items-center justify-center gap-2"
            size="lg"
            onClick={() => {
              window.location.href = getOAuthUrl();
            }}
          >
            <LogIn className="w-4 h-4" />
            Sign in with Kimi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
