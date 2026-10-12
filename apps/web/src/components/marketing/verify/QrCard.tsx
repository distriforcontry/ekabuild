"use client";
import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { CopyButton } from "@/components/marketing/CopyButton";

/** QR code of the current verification page (always dark-on-paper so any phone can scan it). */
export function QrCard({ url, code }: { url: string; code: string }) {
  const { t } = useI18n();
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-2xl p-3 shadow-card ring-1 ring-gold-500/30" style={{ background: "#F4F1EA" }}>
        <QRCodeSVG
          value={url}
          size={176}
          level="H"
          bgColor="#F4F1EA"
          fgColor="#121214"
          marginSize={1}
          title={`${t("landing.pages.verifyResult.qrTitle")}: ${code}`}
          imageSettings={{ src: "/brand/mark.svg", width: 26, height: 42, excavate: true }}
        />
      </div>
      <div className="mt-3 max-w-full truncate font-mono text-[11px] text-ink-400">{url.replace(/^https?:\/\//, "")}</div>
      <div className="mt-3 flex items-center gap-2">
        <CopyButton value={url} label={t("landing.common.copyLink")} done={t("landing.common.linkCopied")} withText className="border border-line px-3 py-1.5" />
        {canShare && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigator.share({ title: `EKA BUILD — ${code}`, url }).catch(() => {})}
            aria-label="Share"
          >
            <Share size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}
