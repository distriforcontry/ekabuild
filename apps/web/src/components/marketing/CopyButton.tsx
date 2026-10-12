"use client";
import * as React from "react";
import { Copy, CopySuccess } from "iconsax-reactjs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Small copy-to-clipboard button with a success state. `value` may be "location" to copy the current URL. */
export function CopyButton({
  value,
  label,
  done,
  className,
  withText = false,
}: {
  value: string;
  label: string;
  done: string;
  className?: string;
  withText?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const text = value === "location" ? window.location.href : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(done);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked (insecure context) — nothing else to do */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-300 transition hover:bg-fg/5 hover:text-stone-100",
        copied && "text-success hover:text-success",
        className,
      )}
    >
      {copied ? <CopySuccess size={15} variant="Bold" /> : <Copy size={15} />}
      {withText && <span>{copied ? done : label}</span>}
    </button>
  );
}
