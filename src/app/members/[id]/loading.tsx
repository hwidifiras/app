import { CardGridSkeleton, LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function MemberDetailLoading() {
  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-4 h-5 w-32 animate-pulse rounded-full bg-[var(--surface-soft)]" />
      <div className="grid gap-4 sm:gap-5">
        <section className="panel p-4 sm:p-5">
          <LoadingSkeleton lines={2} />
        </section>
        <div className="grid min-w-0 items-start gap-4 sm:gap-5 lg:grid-cols-12">
          <div className="contents">
            <section className="panel order-2 p-4 sm:p-5 lg:col-span-8 lg:row-start-1">
              <CardGridSkeleton cards={2} className="xl:grid-cols-2" />
            </section>
            <section className="panel order-3 p-4 sm:p-5 lg:col-span-8 lg:row-start-2">
              <CardGridSkeleton />
            </section>
            <section className="panel order-6 p-4 sm:p-5 lg:col-span-8 lg:row-start-3">
              <LoadingSkeleton lines={4} />
            </section>
          </div>
          <aside className="contents">
            <section className="panel order-1 p-4 sm:p-5 lg:col-span-4 lg:row-start-1"><LoadingSkeleton lines={4} /></section>
            <section className="panel order-4 p-4 sm:p-5 lg:col-span-4 lg:row-start-2"><LoadingSkeleton lines={2} /></section>
            <section className="panel order-5 p-4 sm:p-5 lg:col-span-12 lg:row-start-4"><CardGridSkeleton /></section>
            <section className="panel order-8 p-4 sm:p-5 lg:col-span-4 lg:row-start-3"><LoadingSkeleton lines={3} /></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
