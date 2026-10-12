"use client";
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown2, CloseCircle, SearchNormal1, TickCircle } from "iconsax-reactjs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type ComboOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** extra text matched by search (e.g. TIN, phone) */
  keywords?: string;
};

type BaseProps = {
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** hide the search box for very short lists */
  searchable?: boolean;
  /** server-side search: called (debounced) with the query instead of local filtering */
  onSearch?: (q: string) => void;
  loading?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
};

type SingleProps = BaseProps & { multiple?: false; value: string | null | undefined; onChange: (v: string | null) => void };
type MultiProps = BaseProps & { multiple: true; value: string[]; onChange: (v: string[]) => void };

// Case- and apostrophe-insensitive, Latin/Cyrillic tolerant match
const norm = (s: string) => s.toLowerCase().replace(/['‘’ʻʼ`]/g, "").normalize("NFKD");

/** Searchable dropdown (single or multi select) with full keyboard support. */
export function Combobox(props: SingleProps | MultiProps) {
  const { t } = useI18n();
  const {
    options,
    placeholder = t("common.combobox.placeholder"),
    searchPlaceholder = t("common.combobox.search"),
    emptyText = t("common.combobox.empty"),
    className,
    disabled,
    clearable = true,
    searchable = true,
    onSearch,
    loading,
    size = "md",
  } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const isSelected = (v: string) => selected.includes(v);

  React.useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(query), 250);
    return () => clearTimeout(id);
  }, [query, onSearch]);

  const filtered = React.useMemo(() => {
    if (onSearch || !query) return options;
    const q = norm(query);
    return options.filter((o) => norm(`${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`).includes(q));
  }, [options, query, onSearch]);

  React.useEffect(() => setActive(0), [query, open]);

  const choose = (opt: ComboOption) => {
    if (opt.disabled) return;
    if (props.multiple) {
      const next = isSelected(opt.value) ? props.value.filter((v) => v !== opt.value) : [...props.value, opt.value];
      props.onChange(next);
    } else {
      props.onChange(opt.value === props.value ? null : opt.value);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) choose(opt);
    }
  };

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const selectedOptions = options.filter((o) => isSelected(o.value));
  const display = props.multiple
    ? selectedOptions.length
      ? selectedOptions.length <= 2
        ? selectedOptions.map((o) => o.label).join(", ")
        : `${selectedOptions[0]!.label} +${selectedOptions.length - 1}`
      : null
    : selectedOptions[0]?.label;

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), !o && setQuery(""))}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={props["aria-label"]}
          aria-expanded={open}
          className={cn(
            "group flex w-full cursor-pointer items-center gap-2 rounded-xl border border-line bg-ink-850 px-3.5 text-left text-sm transition-colors hover:border-line-strong focus:outline-none focus-visible:border-gold-500/60 focus-visible:ring-4 focus-visible:ring-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-gold-500/60",
            size === "sm" ? "h-9" : "h-11",
            className,
          )}
        >
          {!props.multiple && selectedOptions[0]?.icon}
          <span className={cn("flex-1 truncate", display ? "text-stone-100" : "text-ink-400")}>{display ?? placeholder}</span>
          {clearable && selected.length > 0 && !disabled && (
            <span role="button" tabIndex={-1} onClick={clear} className="text-ink-400 transition hover:text-stone-100" aria-label="clear">
              <CloseCircle size={16} />
            </span>
          )}
          <ArrowDown2 size={16} className="text-ink-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onKeyDown={onKeyDown}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-xl border border-line-strong bg-ink-850/95 shadow-lift backdrop-blur-xl data-[state=open]:animate-[popIn_.18s_ease-out]"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-3">
              <SearchNormal1 size={16} className="text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 flex-1 bg-transparent text-sm text-stone-100 placeholder:text-ink-400 focus:outline-none"
              />
              {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-ink-500 border-t-gold-400" />}
            </div>
          )}
          <div ref={listRef} role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-ink-400">{emptyText}</div>
            ) : (
              filtered.map((o, i) => {
                const sel = isSelected(o.value);
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={sel}
                    aria-disabled={o.disabled}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      i === active ? "bg-fg/6 text-stone-100" : "text-ink-200",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {props.multiple && (
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded border transition",
                          sel ? "border-gold-400 bg-gold-400 text-onyx" : "border-line-strong",
                        )}
                      >
                        {sel && (
                          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m2.5 6 2.5 2.5 4.5-5" />
                          </svg>
                        )}
                      </span>
                    )}
                    {o.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block truncate text-xs text-ink-400">{o.description}</span>}
                    </span>
                    {!props.multiple && sel && <TickCircle size={16} variant="Bold" className="text-gold-400" />}
                  </div>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
