import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { WeDisciplineHomepage } from "@/components/marketing/we-discipline-homepage";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://we-discipline.com"),
  title: "We Discipline | Plateforme de gestion pour clubs d'arts martiaux",
  description:
    "We Discipline aide les clubs d'arts martiaux en Tunisie à gérer pointage, abonnements, caisse, groupes, coachs, élèves, reçus et communication.",
  alternates: {
    canonical: "/accueil",
  },
  openGraph: {
    title: "We Discipline | Gérez votre club d'arts martiaux avec discipline.",
    description:
      "Plateforme de gestion pour clubs d'arts martiaux en Tunisie: pointage, abonnements, caisse, groupes, coachs, élèves, reçus et progression.",
    type: "website",
    locale: "fr_FR",
    url: "/accueil",
    images: [
      {
        url: "/we-discipline/coach-portrait.webp",
        width: 1536,
        height: 1024,
        alt: "Coach d'arts martiaux We Discipline dans un dojo premium",
      },
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "We Discipline",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Plateforme de gestion pour clubs d'arts martiaux en Tunisie: pointage, abonnements, caisse, groupes, coachs, élèves, reçus, progression et communication.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "49",
    highPrice: "349",
    priceCurrency: "TND",
    offerCount: "6",
  },
  areaServed: "TN",
  inLanguage: "fr-FR",
  audience: {
    "@type": "Audience",
    audienceType: "Propriétaires de clubs d'arts martiaux, coachs, sensei et managers de clubs sportifs",
  },
};

export default function AccueilPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WeDisciplineHomepage fontClassName={inter.className} />
    </>
  );
}
