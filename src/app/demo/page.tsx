import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { DemoWorkspace } from "@/components/marketing/demo-workspace";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Démo interactive | We Discipline",
  description: "Explorez un espace de démonstration We Discipline avec membres, séances, présences, paiements, alertes et planning fictifs.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoPage() {
  return (
    <div className={inter.className}>
      <DemoWorkspace />
    </div>
  );
}
