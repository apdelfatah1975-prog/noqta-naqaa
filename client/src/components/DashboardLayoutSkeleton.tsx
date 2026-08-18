import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background" dir="rtl" aria-busy="true" aria-label="جارٍ فتح التطبيق">
      <div className="hidden min-h-screen w-[280px] border-r border-border bg-background p-4 md:block">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-6 space-y-2 px-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        </div>

        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">جارٍ فتح التطبيق…</p>
      </div>
    </div>
  );
}
