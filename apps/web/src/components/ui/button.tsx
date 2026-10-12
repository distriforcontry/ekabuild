"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-300 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        gold: "bg-gold-gradient text-onyx shadow-glow hover:brightness-110 hover:shadow-[0_0_0_1px_rgb(201_164_100/0.5),0_16px_50px_-12px_rgb(201_164_100/0.55)] overflow-hidden",
        primary: "bg-stone-100 text-ink-950 hover:opacity-90",
        secondary: "bg-ink-800 text-ink-100 border border-line hover:border-line-strong hover:bg-ink-700",
        outline: "border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 hover:border-gold-400",
        ghost: "text-ink-200 hover:bg-fg/5 hover:text-stone-100",
        danger: "bg-danger/90 text-white hover:bg-danger",
        success: "bg-success/90 text-onyx hover:bg-success",
        link: "text-gold-300 underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-xs [&_svg]:size-3.5",
        md: "h-10 rounded-xl px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-xl px-6 text-[15px] [&_svg]:size-4.5",
        xl: "h-14 rounded-2xl px-8 text-base [&_svg]:size-5",
        icon: "size-10 rounded-xl [&_svg]:size-4.5",
        "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
