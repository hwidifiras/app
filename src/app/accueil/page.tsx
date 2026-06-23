import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { WeDisciplineHomepage } from "@/components/marketing/we-discipline-homepage";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wediscipline.com"),
  title: "We Discipline | Plateforme de gestion pour clubs d'arts martiaux",
  description:
    "We Discipline aide les dojos, sensei et clubs d'arts martiaux à gérer élèves, présences, paiements, grades, compétitions et communauté depuis une seule plateforme.",
  alternates: {
    canonical: "/accueil",
  },
  openGraph: {
    title: "We Discipline | Bâtissez des champions. Gérez votre académie.",
    description:
      "La plateforme SaaS premium pensée pour les académies d'arts martiaux, du premier cours au passage de ceinture noire.",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "/we-discipline/coach-portrait.png",
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
    "Plateforme de gestion pour académies d'arts martiaux: élèves, présences, abonnements, paiements, grades, compétitions et communication.",
  offers: {
    "@type": "Offer",
    price: "29",
    priceCurrency: "EUR",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Propriétaires d'académies, coaches, sensei et managers de clubs sportifs",
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
