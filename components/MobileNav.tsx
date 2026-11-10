"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import CategoryNav, { type NavCategory } from "@/components/CategoryNav";

export default function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-paper/40 px-3 py-1.5 text-sm text-paper"
      >
        <span className="sr-only">Άνοιγμα μενού</span>
        <span aria-hidden className="flex flex-col gap-1">
          <span className="block h-px w-4 bg-paper" />
          <span className="block h-px w-4 bg-paper" />
          <span className="block h-px w-3 bg-paper" />
        </span>
        Μενού
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={() => setOpen(false)}>
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Μενού"
            className="nav-wash flex h-full w-[min(100%,22rem)] flex-col px-6 py-5 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 font-serif text-2xl text-pine">
                <span className="grid size-8 place-items-center rounded-md bg-pine font-serif text-lg leading-none text-paper" aria-hidden>
                  M
                </span>
                Monomaxos
              </Link>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-line px-3 py-1.5 text-sm"
              >
                Κλείσιμο
              </button>
            </div>
            <CategoryNav
              categories={categories}
              onNavigate={() => setOpen(false)}
              className="mt-8 flex flex-col gap-4"
              itemClassName="font-serif text-2xl leading-tight"
            />
            <div className="mt-auto flex gap-4 border-t border-line pt-4 text-sm text-muted">
              <Link href="/privacy-policy" onClick={() => setOpen(false)} className="hover:text-pine">
                Απόρρητο
              </Link>
              <Link href="/terms-conditions" onClick={() => setOpen(false)} className="hover:text-pine">
                Όροι
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
