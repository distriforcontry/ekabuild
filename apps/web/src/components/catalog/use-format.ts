"use client";
import * as React from "react";
import { useI18n } from "@/i18n/client";
import { makeFormat } from "./format";

/** Client hook: locale-aware money / date / area formatters. */
export function useFormat() {
  const { locale, t, tr, raw } = useI18n();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => makeFormat({ locale, t, tr, raw }), [locale]);
}
