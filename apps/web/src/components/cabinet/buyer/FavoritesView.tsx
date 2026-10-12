"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Buildings, Heart } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { ProjectCard } from "@/lib/types";
import { asList, useApi } from "../hooks";
import { ProjectMiniCard } from "../ProjectMiniCard";
import { CardGridSkeleton, ErrorState } from "../states";
import { PageHead, PanelEmpty as EmptyState } from "../kit";

export function FavoritesView() {
  const { t } = useI18n();
  const { data, loading, error, reload, setData } = useApi<ProjectCard[]>("/favorites", undefined, { select: asList });

  const toggle = (p: ProjectCard) => api.post<{ favorite: boolean }>(`/projects/${p.id}/favorite`);

  const remove = async (p: ProjectCard) => {
    const list = data ?? [];
    const index = list.findIndex((x) => x.id === p.id);
    setData(list.filter((x) => x.id !== p.id));
    try {
      await toggle(p);
      toast.success(t("app.favorites.removed"), {
        action: {
          label: t("app.favorites.undo"),
          onClick: async () => {
            try {
              await toggle(p);
              setData((cur) => {
                const next = [...(cur ?? [])];
                next.splice(Math.max(0, index), 0, p);
                return next;
              });
            } catch {
              toast.error(t("common.errors.generic"));
            }
          },
        },
      });
    } catch {
      setData(list);
      toast.error(t("common.errors.generic"));
    }
  };

  const list = data ?? [];

  return (
    <div>
      <PageHead icon={Heart}
        eyebrow={t("app.shell.area")}
        title={t("app.favorites.title")}
        description={t("app.favorites.subtitle")}
        actions={
          <Button asChild variant="secondary">
            <Link href="/projects">
              <Buildings size={18} /> {t("app.dashboard.browse")}
            </Link>
          </Button>
        }
      />
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("app.favorites.empty")}
          description={t("app.favorites.emptyHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/projects">{t("app.dashboard.browse")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {list.map((p, i) => (
              <ProjectMiniCard
                key={p.id}
                project={p}
                index={i}
                action={
                  <button
                    type="button"
                    onClick={() => void remove(p)}
                    aria-label={t("app.favorites.remove")}
                    title={t("app.favorites.remove")}
                    className="grid size-9 cursor-pointer place-items-center rounded-full border border-gold-500/40 bg-ink-950/70 text-gold-300 backdrop-blur transition hover:scale-110 hover:bg-danger/20 hover:text-danger active:scale-95"
                  >
                    <Heart size={18} variant="Bold" />
                  </button>
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
