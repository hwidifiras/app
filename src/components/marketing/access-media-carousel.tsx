"use client";

import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  QrCode,
  ScanLine,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

type AccessMedium = {
  title: string;
  shortLabel: string;
  description: string;
  detail: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  availability: string;
  availabilityDetail: string;
};

const AUTO_ADVANCE_DELAY = 6500;

const accessMedia: AccessMedium[] = [
  {
    title: "Carte membre avec QR code",
    shortLabel: "QR code",
    description: "Un support simple à imprimer et à scanner depuis un téléphone ou une tablette à l'accueil.",
    detail: "Le membre est identifié sans recherche manuelle, puis les règles d'abonnement restent visibles avant le pointage.",
    image: "/we-discipline/access-qr.webp",
    alt: "Carte membre QR scannée avec un téléphone dans un club d'arts martiaux",
    icon: QrCode,
    availability: "Activation accompagnée",
    availabilityDetail: "Sans lecteur spécialisé",
  },
  {
    title: "Carte RFID sans contact",
    shortLabel: "Carte RFID",
    description: "Une carte durable pour fluidifier l'arrivée des élèves et limiter les manipulations à la réception.",
    detail: "L'intégration dépend du lecteur choisi. Nous validons le matériel et le parcours avant toute activation.",
    image: "/we-discipline/access-rfid-card.webp",
    alt: "Carte RFID présentée sur un lecteur dans un dojo",
    icon: ScanLine,
    availability: "Après validation",
    availabilityDetail: "Lecteur compatible requis",
  },
  {
    title: "Bracelet RFID",
    shortLabel: "Bracelet",
    description: "Un format pratique pour les clubs qui veulent un support résistant et facile à porter pendant les cours.",
    detail: "Le bracelet utilise le même principe d'identification que la carte RFID, avec une configuration adaptée au club.",
    image: "/we-discipline/access-rfid-wristband.webp",
    alt: "Bracelet RFID utilisé à l'entrée d'un club d'arts martiaux",
    icon: Waves,
    availability: "Après validation",
    availabilityDetail: "Matériel compatible requis",
  },
];

export function AccessMediaCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const active = accessMedia[activeIndex];
  const isPaused = pausedByUser || interacting;

  useEffect(() => {
    if (isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % accessMedia.length);
    }, AUTO_ADVANCE_DELAY);

    return () => window.clearInterval(timer);
  }, [activeIndex, isPaused]);

  const selectPrevious = () => setActiveIndex((current) => (current - 1 + accessMedia.length) % accessMedia.length);
  const selectNext = () => setActiveIndex((current) => (current + 1) % accessMedia.length);

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
        <div className="relative aspect-[4/3] min-h-[280px] bg-slate-100 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[500px]">
          <Image src={active.image} alt={active.alt} fill sizes="(min-width: 1024px) 62vw, 100vw" className="object-cover" priority={activeIndex === 0} />
          <div className="absolute left-4 top-4 rounded-md border border-white/70 bg-white/95 px-3 py-2 shadow-sm">
            <p className="text-xs font-black text-slate-900">{active.availability}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{active.availabilityDetail}</p>
          </div>
        </div>

        <div className="flex min-h-[400px] flex-col justify-between p-6 sm:p-8 lg:min-h-[500px]">
          <div id="access-medium-panel" aria-live={isPaused ? "polite" : "off"}>
            <active.icon className="size-9 text-blue-600" aria-hidden="true" />
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Support de pointage</p>
            <h3 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{active.title}</h3>
            <p className="mt-5 text-base leading-7 text-slate-600">{active.description}</p>
            <p className="mt-4 text-sm leading-6 text-slate-500">{active.detail}</p>
          </div>

          <div className="mt-8">
            <div className="grid gap-2" role="tablist" aria-label="Supports de pointage">
              {accessMedia.map((medium, index) => (
                <button
                  key={medium.shortLabel}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  aria-controls="access-medium-panel"
                  className={index === activeIndex ? "flex min-h-11 items-center justify-between gap-3 rounded-md border border-blue-600 bg-blue-50 px-3 py-2 text-left text-xs font-bold text-blue-900" : "flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700"}
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{medium.shortLabel}</span>
                  <span className={index === activeIndex ? "text-blue-600" : "text-slate-400"}>{index + 1}/3</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500" aria-live="polite">
                <span className={`size-2 rounded-full ${isPaused ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
                {isPaused ? "Défilement en pause" : "Défilement automatique"}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPausedByUser((value) => !value)}
                  className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  aria-label={pausedByUser ? "Relancer le défilement automatique" : "Mettre le défilement automatique en pause"}
                >
                  {pausedByUser ? <Play className="size-5" aria-hidden="true" /> : <Pause className="size-5" aria-hidden="true" />}
                </button>
                <button type="button" onClick={selectPrevious} className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700" aria-label="Support précédent">
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={selectNext} className="inline-flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white hover:bg-blue-700" aria-label="Support suivant">
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
