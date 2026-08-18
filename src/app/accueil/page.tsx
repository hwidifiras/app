import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { WeDisciplineHomepage } from "@/components/marketing/we-discipline-homepage";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://we-discipline.com"),
  title: "We Discipline | Logiciel de gestion pour clubs d'arts martiaux",
  description:
    "Gérez les inscriptions, présences, paiements, reçus, groupes, planning et comptes coachs de votre club d'arts martiaux avec We Discipline.",
  alternates: {
    canonical: "/accueil",
  },
  openGraph: {
    title: "We Discipline | Le quotidien de votre club, enfin au même endroit",
    description:
      "Logiciel de gestion pour clubs d'arts martiaux : inscriptions, pointage, abonnements, caisse, planning, reçus et comptes coachs.",
    type: "website",
    locale: "fr_FR",
    url: "/accueil",
    images: [
      {
        url: "/we-discipline/hero-dashboard-reception.webp",
        width: 1536,
        height: 1024,
        alt: "Tableau de bord We Discipline pour clubs d'arts martiaux",
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
    "Logiciel de gestion pour clubs d'arts martiaux : inscriptions, présences, paiements, reçus, groupes, planning et comptes coachs.",
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
