"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, MonitorPlay, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Pointage", href: "#pointage" },
  { label: "Coachs", href: "#coachs" },
  { label: "Formules", href: "#formules" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Navigation principale">
        <Link href="/accueil" className="relative h-11 w-[148px] shrink-0" aria-label="Accueil We Discipline">
          <Image src="/we-discipline/navbar-logo.svg" alt="We Discipline" fill sizes="148px" className="object-contain" priority unoptimized />
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600">
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-600">
            Connexion
          </Link>
          <Link href="/demo" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
            <MonitorPlay className="size-4" aria-hidden="true" />
            Voir la démo
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900 lg:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-5 py-4 shadow-lg lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link href="/login" className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Connexion
            </Link>
            <Link href="/demo" className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white" onClick={() => setOpen(false)}>
              <MonitorPlay className="size-4" aria-hidden="true" />
              Voir la démo
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
