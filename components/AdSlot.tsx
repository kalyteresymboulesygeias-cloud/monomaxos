"use client";

import { useEffect, useRef } from "react";

export type AdFormat = "leaderboard" | "infeed" | "article" | "sidebar";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const MIN_HEIGHT: Record<AdFormat, string> = {
  leaderboard: "min-h-[90px] sm:min-h-[110px]",
  infeed: "min-h-[250px]",
  article: "min-h-[250px]",
  sidebar: "min-h-[280px]",
};

export default function AdSlot({
  format,
  slot,
  className = "",
}: {
  format: AdFormat;
  slot?: string;
  className?: string;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const pushed = useRef(false);
  const live = Boolean(client && slot);
  const margin = format === "leaderboard" || format === "sidebar" ? "" : "my-8";

  useEffect(() => {
    if (!live || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      pushed.current = false;
    }
  }, [live]);

  return (
    <aside
      aria-label="Διαφήμιση"
      className={`${margin} ${MIN_HEIGHT[format]} ${className}`}
    >
      <div className="flex h-full min-h-[inherit] flex-col rounded-xl border border-dashed border-line bg-paper-deep/70">
        {live ? (
          <>
            <p className="px-3 pt-2 text-center text-[10px] tracking-[0.18em] text-muted">Διαφήμιση</p>
            <ins
              className="adsbygoogle mx-auto block min-h-0 w-full flex-1"
              style={{ display: "block" }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center px-3 text-center text-[10px] tracking-[0.18em] text-muted">
            Διαφήμιση
          </p>
        )}
      </div>
    </aside>
  );
}
