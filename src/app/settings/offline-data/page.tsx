import Link from "next/link";
import { notFound } from "next/navigation";
import { OfflineRecovery } from "@/components/settings/offline-recovery";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthUser } from "@/lib/request-user";

export default async function OfflineDataPage() {
  if (process.env.OFFLINE_DESKTOP !== "1") notFound();
  const user = await getAuthUser();
  if (user?.role !== "ADMIN") return <main className="app-shell py-8">Accès administrateur requis.</main>;
  return <main className="app-shell space-y-5 py-8"><PageHeader overline="Données locales" title="Sauvegarde et récupération" description="Les données restent sur cet ordinateur. Conservez aussi une sauvegarde sur un autre support." /><OfflineRecovery /><Link href="/settings/data-import" className="btn btn-primary">Importer des élèves depuis Excel</Link></main>;
}
