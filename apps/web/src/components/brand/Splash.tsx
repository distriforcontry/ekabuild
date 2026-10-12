"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { TOWER_POINTS } from "./Logo";
import { useI18n } from "@/i18n/client";

/**
 * Cinematic brand intro on the first full page load of "/" in a browser session (~2.1 s, then the curtain
 * splits). Repeat visits in the same session render the hero immediately with no gate.
 *
 * The whole timeline is CSS (globals.css → "Splash"), so it starts with the first paint and never waits for
 * hydration; the overlay is `display:none` unless the inline script below — which runs before the overlay is
 * parsed — sets `<html data-eka-splash="play">`. So repeat visits (sessionStorage), deep links (/verify/<code>,
 * /projects, "/#faq"), client-side navigations, reduced-motion visitors and no-JS visitors never see it (and
 * never see a flash of it). The script also flags `<html data-js>` so images only fade in when JS exists.
 *
 * <html> states: play → leaving (curtain opening, hero starts) → done · or "off".
 * `data-eka-intro` + `--gate` hold the CSS-driven hero entrance until the curtain opens (see .eka-in / .eka-word).
 * Click, Esc, Enter or Space skips.
 */

/** Fired on window when the curtain starts to open (or right away when there is no intro). */
export const SPLASH_DONE_EVENT = "eka:splash-done";
/** `<html data-eka-splash>`: "play" · "leaving" · "done" · "off". */
export const SPLASH_ATTR = "data-eka-splash";

/** true once the intro is no longer covering the page (or never ran) */
export function splashSettled() {
  if (typeof document === "undefined") return false;
  const s = document.documentElement.getAttribute(SPLASH_ATTR);
  return s !== "play";
}

/** Subscribe to "the hero may start": resolves immediately when there is no intro. */
export function useSplashSettled() {
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => {
    if (splashSettled()) {
      setSettled(true);
      return;
    }
    const go = () => setSettled(true);
    window.addEventListener(SPLASH_DONE_EVENT, go);
    const fallback = setTimeout(go, 2800);
    return () => {
      window.removeEventListener(SPLASH_DONE_EVENT, go);
      clearTimeout(fallback);
    };
  }, []);
  return settled;
}

const KEY = "eka_splash_seen";
const SCRIPT = `(function(){var d=document.documentElement,A="${SPLASH_ATTR}",E="${SPLASH_DONE_EVENT}";
d.setAttribute("data-js","");
function fire(){try{window.dispatchEvent(new Event(E))}catch(e){}}
try{
if(d.getAttribute(A)){return}
var seen=false;try{seen=!!sessionStorage.getItem("${KEY}")}catch(e){}
var show=!seen&&location.pathname==="/"&&!location.hash&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(!show){d.setAttribute(A,"off");return}
try{sessionStorage.setItem("${KEY}","1")}catch(e){}
d.setAttribute(A,"play");d.setAttribute("data-eka-intro","");
var t0=performance.now(),st="play";
function done(){if(st==="done")return;st="done";d.setAttribute(A,"done");d.removeAttribute("data-eka-skip");removeEventListener("keydown",key,true);removeEventListener("click",click,true)}
function leave(skip){if(st!=="play")return;st="leaving";if(skip){d.setAttribute("data-eka-skip","");d.style.setProperty("--gate",Math.round(performance.now()-t0)+"ms")}d.setAttribute(A,"leaving");fire();setTimeout(done,skip?800:900)}
function early(){return performance.now()-t0<1950}
function key(e){if((e.key==="Escape"||e.key==="Enter"||e.key===" ")&&st==="play"&&early()){e.preventDefault();leave(true)}}
function click(e){var s=document.getElementById("eka-splash");if(st==="play"&&s&&s.contains(e.target)&&early()){leave(true)}}
addEventListener("keydown",key,true);addEventListener("click",click,true);
setTimeout(function(){leave(false)},2100);
setTimeout(function(){d.removeAttribute("data-eka-intro");d.style.removeProperty("--gate")},6000);
addEventListener("pageshow",function(e){if(e.persisted)done()});
}catch(e){d.setAttribute(A,"off")}})();`;

const VIEW = "0 0 120 200";
const FONT = "'Manrope Variable', Manrope, 'Helvetica Neue', Arial, sans-serif";
const LETTERS = [
  { ch: "E", y: 62, cls: "sp-l1" },
  { ch: "K", y: 122, cls: "sp-l2" },
  { ch: "A", y: 182, cls: "sp-l3" },
];

export function Splash() {
  const { t } = useI18n();
  const pathname = usePathname();
  const uid = React.useId().replace(/:/g, "");

  // Mounted by a client-side navigation (the inline script never ran) → there is no intro on this page view.
  React.useLayoutEffect(() => {
    const d = document.documentElement;
    if (!d.getAttribute(SPLASH_ATTR)) d.setAttribute(SPLASH_ATTR, "off");
  }, []);

  // Leaving the landing page: drop the hero gate so a later client-side visit to "/" animates without delay.
  React.useEffect(() => {
    if (pathname === "/") return;
    const d = document.documentElement;
    d.removeAttribute("data-eka-intro");
    d.style.removeProperty("--gate");
  }, [pathname]);

  const gold = `sp-gold-${uid}`;
  const goldHi = `sp-goldhi-${uid}`;
  const brush = `sp-brush-${uid}`;
  const ink = `sp-ink-${uid}`;
  const cut = `sp-cut-${uid}`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div id="eka-splash" aria-hidden="true">
        <div className="sp-panel sp-top" />
        <div className="sp-panel sp-bot" />
        <div className="sp-grid" />
        <div className="sp-atmo" />
        <div className="sp-seam" />

        <div className="sp-stage">
          <div className="sp-col">
            <div className="sp-mark">
              {/* 1 — outline draws */}
              <svg viewBox={VIEW} className="sp-outline" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F1DFB2" />
                    <stop offset="0.38" stopColor="#D2B071" />
                    <stop offset="0.72" stopColor="#B38D50" />
                    <stop offset="1" stopColor="#8A6A38" />
                  </linearGradient>
                  <linearGradient id={goldHi} x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FBF0D4" />
                    <stop offset="0.45" stopColor="#DDBD7E" />
                    <stop offset="1" stopColor="#9E7C44" />
                  </linearGradient>
                  <pattern id={brush} width="120" height="3" patternUnits="userSpaceOnUse">
                    <rect width="120" height="1" fill="#fff" opacity="0.07" />
                  </pattern>
                  <linearGradient id={ink} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2B2620" />
                    <stop offset="1" stopColor="#14120F" />
                  </linearGradient>
                  <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
                    <rect width="120" height="200" fill="#fff" />
                    <polygon points={TOWER_POINTS} fill="#000" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
                  </mask>
                </defs>
                <rect className="sp-outline-rect" x="0.75" y="0.75" width="118.5" height="198.5" fill="none" stroke={`url(#${gold})`} strokeWidth="1.5" pathLength={1} />
              </svg>

              {/* 2 — brushed plate fills from the bottom (tower slot already cut) */}
              <svg viewBox={VIEW} className="sp-plate">
                <g mask={`url(#${cut})`}>
                  <rect width="120" height="200" fill={`url(#${gold})`} />
                  <rect width="120" height="200" fill={`url(#${brush})`} />
                </g>
              </svg>

              {/* 3 — engraved E · K · A rise one by one */}
              {LETTERS.map((l) => (
                <svg key={l.ch} viewBox={VIEW} className={`sp-letter ${l.cls}`}>
                  <g fontFamily={FONT} fontWeight={800} fontSize="44" textAnchor="middle">
                    <text x="34" y={l.y} fill="#FFF3D6" opacity="0.55" transform="translate(0 1.2)">
                      {l.ch}
                    </text>
                    <text x="34" y={l.y} fill={`url(#${ink})`}>
                      {l.ch}
                    </text>
                  </g>
                </svg>
              ))}

              {/* 4 — the "1" / tower slides up into its slot */}
              <div className="sp-tower-clip">
                <svg viewBox={VIEW} className="sp-tower" style={{ width: "100%", height: "100%" }}>
                  <polygon points={TOWER_POINTS} fill={`url(#${goldHi})`} />
                  <polygon points={TOWER_POINTS} fill={`url(#${brush})`} />
                </svg>
              </div>

              {/* 5 — light sweep across the metal */}
              <div className="sp-sheen-clip">
                <div className="sp-sheen" />
              </div>
            </div>

            {/* 6 — BUILD letter-spaces in, 7 — progress line, 8 — tagline */}
            <div className="sp-word">Build</div>
            <div className="sp-line">
              <span />
            </div>
            <div className="sp-tag">{t("landing.splash.tagline")}</div>
          </div>
        </div>

        <button type="button" className="sp-skip" tabIndex={-1}>
          {t("landing.splash.skip")} <kbd>Esc</kbd>
        </button>
      </div>
    </>
  );
}
