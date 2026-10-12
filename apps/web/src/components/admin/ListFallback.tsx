import { Skeleton } from "@/components/ui/skeleton";

/** Suspense fallback for admin list pages (header + table skeleton). */
export function ListFallback({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy>
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-ink-900">
        <div className="flex gap-3 border-b border-line p-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
