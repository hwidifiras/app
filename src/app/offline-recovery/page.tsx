import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfflineRecovery } from "@/components/settings/offline-recovery";

export default function OfflineRecoveryPage() {
  if (process.env.OFFLINE_DESKTOP !== "1") notFound();
  return <main className="mx-auto min-h-screen max-w-2xl space-y-6 px-4 py-12">
    <Image src="/we-discipline/navbar-logo.png" alt="We Discipline" width={375} height={125} priority />
    <h1 className="text-2xl font-bold">We Discipline sur cet ordinateur</h1>
    <OfflineRecovery initial />
    <Link href="/login" className="btn btn-ghost">Retour à la connexion</Link>
  </main>;
}
