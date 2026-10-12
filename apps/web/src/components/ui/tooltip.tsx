"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-line-strong bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 shadow-lift"
          >
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
