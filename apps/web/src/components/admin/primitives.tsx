"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { CloseCircle, CloudCross, FilterRemove, More, Refresh, SearchNormal1 } from "iconsax-reactjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/i18n/client";
import { errorMessage } from "@/lib/api";
import { cn, initials } from "@/lib/utils";

/* ───────────────────────────── Switch ───────────────────────────── */

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  loading,
  size = "md",
  className,
  ...aria
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
}) {
  const w = size === "sm" ? 34 : 42;
  const h = size === "sm" ? 20 : 24;
  const k = h - 6;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      style={{ width: w, height: h }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-gold-400 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-gold-500/50 bg-gold-gradient shadow-[0_0_14px_-4px_rgb(201_164_100/0.6)]" : "border-line-strong bg-ink-800",
        className,
      )}
      {...aria}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? w - k - 6 : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
        style={{ width: k, height: k }}
        className={cn("grid place-items-center rounded-full shadow-sm", checked ? "bg-onyx/85 text-gold-300" : "bg-ink-300 text-ink-800")}
      >
        {loading && <Spinner className="size-2.5" />}
      </motion.span>
    </button>
  );
}

/** Switch that flips instantly and rolls back if the request fails. */
export function OptimisticSwitch({
  checked,
  onChange,
  successText,
  disabled,
  size = "sm",
  ...aria
}: {
  checked: boolean;
  onChange: (v: boolean) => Promise<unknown>;
  successText?: (v: boolean) => string;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const [value, setValue] = React.useState(checked);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setValue(checked), [checked]);
  return (
    <Switch
      size={size}
      checked={value}
      loading={busy}
      disabled={disabled || busy}
      {...aria}
      onCheckedChange={async (v) => {
        setValue(v);
        setBusy(true);
        try {
          await onChange(v);
          if (successText) toast.success(successText(v));
        } catch (e) {
          setValue(!v);
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/* ───────────────────────────── Side sheet ───────────────────────────── */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-onyx/55 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line-strong bg-ink-900 shadow-lift focus:outline-none",
                  width,
                )}
                initial={reduce ? { opacity: 0 } : { x: "100%" }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: "100%" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-start gap-4 border-b border-line px-6 py-5">
                  <div className="min-w-0 flex-1">
                    <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-stone-100">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="mt-1 text-sm text-ink-300">{description}</DialogPrimitive.Description>
                    ) : (
                      <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : ""}</DialogPrimitive.Description>
                    )}
                  </div>
                  <DialogPrimitive.Close className="-mr-2 cursor-pointer rounded-lg p-1.5 text-ink-300 transition hover:bg-fg/5 hover:text-stone-100">
                    <CloseCircle size={20} />
                    <span className="sr-only">{t("common.actions.close")}</span>
                  </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line bg-ink-900/95 px-6 py-4">{footer}</div>}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/* ───────────────────────────── Confirm dialog ───────────────────────────── */

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "gold" | "danger" | "success";
  /** ask for a reason / note */
  reason?: { label: string; placeholder?: string; required?: boolean; initial?: string };
  icon?: IconType;
  onConfirm: (reason: string) => Promise<unknown> | unknown;
};

/** Imperative confirm dialog: const confirm = useConfirm(); confirm({ title, onConfirm }) */
export function useConfirm() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  const confirm = React.useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
  }, []);
  const node = opts ? <ConfirmDialog key={opts.title} open={open} onOpenChange={setOpen} {...opts} /> : null;
  return [confirm, node] as const;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "gold",
  reason,
  icon: Icon,
  onConfirm,
}: ConfirmOptions & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const [text, setText] = React.useState(reason?.initial ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (open) {
      setText(reason?.initial ?? "");
      setErr(null);
    }
  }, [open, reason?.initial]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (reason?.required && !text.trim()) {
      setErr(t("admin.common.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await onConfirm(text.trim());
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const iconTone = tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-gold-500/30 bg-gold-500/10 text-gold-300";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="sm">
        <form onSubmit={submit}>
          <DialogHeader className="flex items-start gap-4">
            {Icon && (
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl border", iconTone)}>
                <Icon size={22} variant="Bulk" />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
            </div>
          </DialogHeader>
          {reason && (
            <DialogBody>
              <Field label={reason.label} htmlFor={id} error={err}>
                <Textarea
                  id={id}
                  autoFocus
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setErr(null);
                  }}
                  placeholder={reason.placeholder}
                  aria-invalid={Boolean(err)}
                  className="min-h-24"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                  }}
                />
              </Field>
            </DialogBody>
          )}
          <DialogFooter className={cn(!reason && "border-t-0 pt-2")}>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" variant={tone === "danger" ? "danger" : tone === "success" ? "success" : "gold"} loading={busy} autoFocus={!reason}>
              {confirmLabel ?? t("common.actions.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Error notice ───────────────────────────── */

export function ErrorNotice({ error, onRetry, className }: { error: string | null; onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", className)}
        >
          <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-danger/25 bg-danger/[0.06] p-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
              <CloudCross size={20} variant="Bulk" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-stone-100">{t("admin.common.loadError")}</div>
              <div className="mt-0.5 text-xs text-ink-300">
                {t("admin.common.loadErrorHint")} <span className="font-mono text-ink-400">({error})</span>
              </div>
            </div>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <Refresh /> {t("common.actions.retry")}
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────── Toolbar pieces ───────────────────────────── */

/** URL-synced, debounced search box for DataTable toolbars. */
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const { t } = useI18n();
  const [text, setText] = React.useState(value);
  const first = React.useRef(true);
  React.useEffect(() => setText(value), [value]);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (text === value) return;
    const id = setTimeout(() => onChange(text.trim()), 320);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <SearchNormal1 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? t("common.table.searchPlaceholder")}
        aria-label={placeholder ?? t("common.actions.search")}
        className="h-9 w-full rounded-xl border border-line bg-ink-850 pl-9 pr-8 text-sm text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange("");
          }}
          aria-label={t("common.actions.reset")}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-ink-400 transition hover:text-stone-100"
        >
          <CloseCircle size={16} />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: ComboOption[];
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full sm:w-48", className)}>
      <Combobox size="sm" value={value} onChange={onChange} options={options} placeholder={placeholder} aria-label={placeholder} searchable={options.length > 6} />
    </div>
  );
}

export function ResetFilters({ count, onReset }: { count: number; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
          <Button size="sm" variant="ghost" onClick={onReset}>
            <FilterRemove /> {t("admin.common.resetFilters")}
            <span className="grid size-4 place-items-center rounded-full bg-gold-500/20 font-mono text-[10px] text-gold-200">{count}</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────── Row actions ───────────────────────────── */

export type RowAction = {
  label: string;
  icon?: IconType;
  onSelect: () => void;
  tone?: "danger" | "success" | "gold";
  disabled?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
};

export function RowActions({ actions, label }: { actions: RowAction[]; label?: string }) {
  const { t } = useI18n();
  const visible = actions.filter((a) => !a.hidden);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={label ?? t("admin.common.actions")}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-300 transition hover:bg-fg/6 hover:text-stone-100 data-[state=open]:bg-fg/8 data-[state=open]:text-stone-100"
        >
          <More size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {label && <DropdownMenuLabel>{label}</DropdownMenuLabel>}
        {visible.map((a, i) => (
          <React.Fragment key={a.label}>
            {a.separatorBefore && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={a.disabled}
              onSelect={a.onSelect}
              className={cn(
                a.disabled && "pointer-events-none opacity-40",
                a.tone === "danger" && "text-danger data-[highlighted]:text-danger [&_svg]:!text-danger",
                a.tone === "success" && "[&_svg]:!text-success",
                a.tone === "gold" && "[&_svg]:!text-gold-300",
              )}
            >
              {a.icon && <a.icon />}
              {a.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────────── Avatar ───────────────────────────── */

export function Avatar({ name, src, size = 36, guest, className }: { name?: string | null; src?: string | null; size?: number; guest?: boolean; className?: string }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl font-bold",
        guest ? "border border-dashed border-line-strong bg-ink-800 text-ink-300" : "bg-gold-gradient text-onyx",
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : name ? initials(name) || "?" : "?"}
    </span>
  );
}

/** Small mono pill with copy-to-clipboard */
export function CopyChip({ value, display, className }: { value: string; display?: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {}
      }}
      title={t("common.actions.copy")}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md border border-line bg-fg/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-200 transition hover:border-line-strong hover:text-stone-100",
        copied && "border-success/40 text-success",
        className,
      )}
    >
      {copied ? t("common.actions.copied") : (display ?? value)}
    </button>
  );
}

/** Section block used inside sheets */
export function DetailSection({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6 last:mb-0", className)}>
      {title && <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{title}</h4>}
      {children}
    </section>
  );
}

/** Wraps a table so a background refetch dims instead of flashing skeletons */
export function Dim({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={cn("transition-opacity duration-300", active && "pointer-events-none opacity-60")}>{children}</div>;
}
