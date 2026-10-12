import { ProjectCardSkeleton } from "@/components/catalog/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { RENDERS } from "@/components/marketing/renders";

export default function CatalogLoading() {
  return (
    <div className="relative isolate pb-24" aria-busy="true">
      <div className="eka-dark relative isolate -mt-20 overflow-hidden bg-[#0b0b0c]">
        <div aria-hidden className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-60 blur-2xl" style={{ backgroundImage: `url("${RENDERS["catalog-band"].lqip}")` }} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0b0b0c_0%,rgb(11_11_12/0.8)_45%,rgb(11_11_12/0.4)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-36 sm:px-6 md:pb-28 md:pt-44 lg:px-8">
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
      </div>
      <div className="relative z-10 mx-auto -mt-14 max-w-7xl px-4 sm:px-6 md:-mt-16 lg:px-8">
        <div className="glass rounded-3xl p-3 shadow-lift md:p-4">
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
