"use client";
import * as React from "react";
import { Messages3 } from "iconsax-reactjs";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openSupport } from "./support-utils";

/** Button that opens the floating support chat (usable from server components). */
export function OpenSupportButton({ children, icon = true, ...props }: Omit<ButtonProps, "onClick" | "asChild"> & { icon?: boolean }) {
  return (
    <Button type="button" {...props} onClick={() => openSupport()}>
      {icon && <Messages3 variant="Bulk" />}
      {children}
    </Button>
  );
}
