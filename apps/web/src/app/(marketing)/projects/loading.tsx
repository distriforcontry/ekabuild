import { ProjectCardSkeleton } from "@/components/catalog/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div className="relative isolate pb-24 pt-24" aria-busy="true">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]">
        <div className="bg-blueprint mask-fade-b absolute inset-0 opacity-70" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pb-10 pt-8 md:pb-14 md:pt-16">
          <Skeleton className="mb-6 h-3 w-40" />
          <Skeleton className="h-14 w-full max-w-xl md:h-20" />
          <Skeleton className="mt-5 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />
          <div className="mt-7 flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-40 rounded-full" />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-ink-900/60 p-3 md:p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="mb-6 mt-8 flex items-end justify-between">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-11 w-72 rounded-xl" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
