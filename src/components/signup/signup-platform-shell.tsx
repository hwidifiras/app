import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";

export function SignupPlatformShell({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#F6F9FF] text-[#0B1220]">
      <header className="border-b border-[#D8E2F0] bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/accueil" className="inline-flex items-center rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#93C5FD]">
            <Image src="/we-discipline/navbar-logo.svg" alt="We Discipline" width={120} height={40} priority />
          </Link>
          <Link
            href="/find-workspace"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#D8E2F0] bg-white px-3 text-sm font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]"
          >
            <LogIn className="size-4" />
            <span className="hidden sm:inline">J’ai déjà un espace</span>
            <span className="sm:hidden">Connexion</span>
          </Link>
        </div>
      </header>

      <div className={compact ? "mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12" : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10"}>
        {children}
      </div>

      <footer className="px-4 pb-8 text-center text-xs text-[#64748B]">
        <Link href="/accueil" className="inline-flex items-center gap-1.5 hover:text-[#2563EB]">
          <ArrowLeft className="size-3.5" />
          Découvrir We Discipline
        </Link>
      </footer>
    </main>
  );
}
