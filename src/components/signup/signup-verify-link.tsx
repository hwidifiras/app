"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { useRouter } from "next/navigation";

import { signupApi } from "@/components/signup/signup-client";
import type { SignupState } from "@/components/signup/signup-types";

export function SignupVerifyLink({ signupId, token }: { signupId?: string; token?: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">(signupId && token ? "loading" : "error");
  const [message, setMessage] = useState(signupId && token ? "Vérification de votre adresse..." : "Ce lien de confirmation est incomplet.");

  useEffect(() => {
    if (!signupId || !token || started.current) return;
    started.current = true;
    window.history.replaceState({}, "", "/signup/verify");

    async function verify() {
      try {
        await signupApi<{ signup: SignupState }>("/api/saas-signup/verify", {
          method: "POST",
          body: JSON.stringify({ signupId, token }),
        });
        setStatus("success");
        setMessage("Email confirmé. Reprise de votre inscription...");
        window.setTimeout(() => router.replace("/signup"), 700);
      } catch (caught) {
        setStatus("error");
        setMessage(caught instanceof Error ? caught.message : "Ce lien n'a pas pu être vérifié.");
      }
    }
    void verify();
  }, [router, signupId, token]);

  return (
    <section className="panel p-6 text-center sm:p-8">
      <span className={status === "error"
        ? "mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600"
        : "mx-auto flex size-14 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]"}
      >
        {status === "loading" ? <Loader2 className="size-7 animate-spin" /> : status === "success" ? <CheckCircle2 className="size-7 text-emerald-600" /> : <MailWarning className="size-7" />}
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-[#0B1220]">Confirmation de l’email</h1>
      <p className="mt-2 text-sm leading-6 text-[#52647A]">{message}</p>
      {status === "error" ? <Link href="/signup" className="btn btn-primary mt-6 w-full">Saisir mon code</Link> : null}
    </section>
  );
}
