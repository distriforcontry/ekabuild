"use client";
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowLeft2, ArrowRight2, Calendar1, CloseCircle } from "iconsax-reactjs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { latinToCyrillic } from "@/i18n/translit";

const MONTHS = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
};
const WEEKDAYS = { uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] };

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string | null | undefined) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const display = (d: Date | null) => (d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "");

/**
 * Date field: typed with a dd.mm.yyyy mask or picked from an animated calendar (month/year navigation,
 * today shortcut, min/max). Value is an ISO date string "yyyy-mm-dd" (or null).
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "kk.oo.yyyy",
  className,
  disabled,
  clearable = true,
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  "aria-label"?: string;
}) {
  const { locale } = useI18n();
  const lang = locale === "ru" ? "ru" : "uz";
  const tr = (s: string) => (locale === "oz" ? latinToCyrillic(s) : s);
  const selected = fromIso(value);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => selected ?? new Date());
  const [text, setText] = React.useState(display(selected));
  const [pickYear, setPickYear] = React.useState(false);
  /** a complete but impossible / out-of-range date was typed */
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setText(display(fromIso(value)));
    setInvalid(false);
  }, [value]);
  React.useEffect(() => {
    if (open) setView(fromIso(value) ?? new Date());
  }, [open, value]);

  const minD = fromIso(min);
  const maxD = fromIso(max);
  const outOfRange = (d: Date) => !!((minD && d < minD) || (maxD && d > maxD));

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.getFullYear(), view.getMonth(), i - offset + 1);
    return { d, inMonth: i >= offset && i < offset + days };
  });
  const today = toIso(new Date());
  const todayDisabled = outOfRange(fromIso(today)!);

  const onType = (s: string) => {
    const digits = s.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(out);
    if (digits.length === 8) {
      const d = new Date(Number(digits.slice(4)), Number(digits.slice(2, 4)) - 1, Number(digits.slice(0, 2)));
      const ok = !Number.isNaN(d.getTime()) && d.getDate() === Number(digits.slice(0, 2)) && !outOfRange(d);
      setInvalid(!ok);
      if (ok) {
        onChange(toIso(d));
        setView(d);
      }
    } else {
      setInvalid(false);
      // required fields (clearable=false) keep their value; the text snaps back on blur
      if (!digits.length && clearable) onChange(null);
    }
  };

  const years = Array.from({ length: 21 }, (_, i) => view.getFullYear() - 10 + i);

  return (
    <Popover.Root open={open} onOpenChange={(o) => (setOpen(o), setPickYear(false))}>
      <div className={cn("relative", className)}>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(e) => onType(e.target.value)}
          onBlur={() => {
            setText(display(fromIso(value)));
            setInvalid(false);
          }}
          className="h-11 w-full rounded-xl border border-line bg-ink-850 pl-3.5 pr-20 font-mono text-sm tracking-wide text-stone-100 placeholder:text-ink-400 transition-colors hover:border-line-strong focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10 disabled:opacity-50 aria-[invalid=true]:border-danger/60 aria-[invalid=true]:focus:ring-danger/10"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {clearable && value && !disabled && (
            <button type="button" onClick={() => onChange(null)} className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-400 transition hover:text-stone-100" aria-label="clear">
              <CloseCircle size={16} />
            </button>
          )}
          <Popover.Trigger asChild disabled={disabled}>
            <button type="button" className="grid size-8 cursor-pointer place-items-center rounded-lg text-gold-400 transition hover:bg-gold-500/10" aria-label="calendar">
              <Calendar1 size={18} variant="Bulk" />
            </button>
          </Popover.Trigger>
        </div>
      </div>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[300px] rounded-2xl border border-line-strong bg-ink-850/95 p-3 shadow-lift backdrop-blur-xl data-[state=open]:animate-[popIn_.18s_ease-out]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-300 hover:bg-fg/5 hover:text-stone-100" aria-label="prev">
              <ArrowLeft2 size={16} />
            </button>
            <button type="button" onClick={() => setPickYear((p) => !p)} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-stone-100 hover:bg-fg/5">
              {tr(MONTHS[lang][view.getMonth()]!)} {view.getFullYear()}
            </button>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-300 hover:bg-fg/5 hover:text-stone-100" aria-label="next">
              <ArrowRight2 size={16} />
            </button>
          </div>
          {pickYear ? (
            <div className="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto p-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => (setView(new Date(y, view.getMonth(), 1)), setPickYear(false))}
                  className={cn("h-9 cursor-pointer rounded-lg font-mono text-sm transition", y === view.getFullYear() ? "bg-gold-gradient text-onyx" : "text-ink-200 hover:bg-fg/6")}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {WEEKDAYS[lang].map((w) => (
                  <span key={w}>{tr(w)}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map(({ d, inMonth }) => {
                  const iso = toIso(d);
                  const isSel = value?.slice(0, 10) === iso;
                  const dis = outOfRange(d);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={dis}
                      onClick={() => (onChange(iso), setOpen(false))}
                      className={cn(
                        "relative h-9 cursor-pointer rounded-lg font-mono text-[13px] transition",
                        !inMonth && "text-ink-500",
                        inMonth && !isSel && "text-ink-100 hover:bg-fg/6",
                        isSel && "bg-gold-gradient font-semibold text-onyx shadow-glow",
                        dis && "cursor-not-allowed opacity-30",
                      )}
                    >
                      {d.getDate()}
                      {iso === today && !isSel && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gold-400" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button
              type="button"
              disabled={todayDisabled}
              onClick={() => (onChange(today), setOpen(false))}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gold-300 hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {lang === "ru" ? "Сегодня" : tr("Bugun")}
            </button>
            {clearable && (
              <button type="button" onClick={() => (onChange(null), setOpen(false))} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-ink-400 hover:bg-fg/5 hover:text-stone-100">
                {lang === "ru" ? "Очистить" : tr("Tozalash")}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
