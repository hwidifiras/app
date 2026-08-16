"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

type RecaptchaApi = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    grecaptcha?: RecaptchaApi;
  }
}
export async function executeSignupRecaptcha(siteKey: string): Promise<string> {
  const recaptcha = window.grecaptcha;
  if (!recaptcha) throw new Error("RECAPTCHA_NOT_READY");
  return new Promise((resolve, reject) => {
    recaptcha.ready(() => {
      recaptcha.execute(siteKey, { action: "workspace_signup" }).then(resolve).catch(reject);
    });
  });
}

export function SignupAntiBotField({
  provider,
  siteKey,
  resetKey,
  onToken,
}: {
  provider: "NONE" | "TURNSTILE" | "RECAPTCHA";
  siteKey: string | null;
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderTurnstile = useCallback(() => {
    if (provider !== "TURNSTILE" || !siteKey || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) window.turnstile.remove(widgetIdRef.current);
    containerRef.current.replaceChildren();
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "workspace_signup",
      theme: "light",
      size: "flexible",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
  }, [onToken, provider, siteKey]);

  useEffect(() => {
    if (provider === "TURNSTILE" && window.turnstile) renderTurnstile();
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [provider, renderTurnstile, resetKey]);

  if (provider === "NONE") return null;
  if (!siteKey) {
    return <p className="text-sm font-medium text-red-700">La vérification de sécurité est indisponible.</p>;
  }
  if (provider === "RECAPTCHA") {
    return <Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`} strategy="afterInteractive" />;
  }
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderTurnstile}
      />
      <div ref={containerRef} className="min-h-[65px] w-full overflow-hidden" aria-label="Vérification de sécurité" />
    </>
  );
}
