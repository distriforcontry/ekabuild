import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div className="relative isolate pb-24 pt-24" aria-busy="true">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]">
        <div className="bg-blueprint mask-fade-b absolute inset-0 opacity-60" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 mt-4 h-3 w-64 md:mt-8" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <div>
            <Skeleton className="aspect-[16/11] w-full rounded-3xl" />
            <div className="mt-3 grid grid-cols-5 gap-2 md:gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          </div>
          <div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-14 w-4/5" />
            <Skeleton className="mt-3 h-5 w-3/5" />
            <Skeleton className="mt-5 h-4 w-2/3" />
            <Skeleton className="mt-5 h-[68px] w-full rounded-2xl" />
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] rounded-none" />
              ))}
            </div>
            <Skeleton className="mt-6 h-2 w-full rounded-full" />
            <div className="mt-7 flex gap-3">
              <Skeleton className="h-12 w-44 rounded-xl" />
              <Skeleton className="h-12 w-56 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <Skeleton className="h-[52px] w-full rounded-2xl" />
            <Skeleton className="mt-8 h-64 w-full rounded-3xl" />
            <Skeleton className="mt-6 h-80 w-full rounded-3xl" />
          </div>
          <div className="order-first lg:order-none">
            <Skeleton className="h-[420px] w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
