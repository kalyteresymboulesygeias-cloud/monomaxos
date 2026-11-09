"use client";

import Image from "next/image";
import { useState } from "react";
import { displayImageSrc, isOptimizableImageSrc } from "@/lib/images";

export default function CoverImage({
  src,
  alt,
  priority = false,
  className = "",
  sizes,
  maxWidth = 960,
}: {
  src?: string;
  alt: string;
  /** LCP image: preload in <head> and fetchpriority=high. Everything else stays lazy. */
  priority?: boolean;
  className?: string;
  sizes: string;
  /** Display width to request from Unsplash. Ignored for files we cannot resize. */
  maxWidth?: number;
}) {
  const resolved = src ? displayImageSrc(src, maxWidth) : undefined;
  // Keyed by src so a reused card does not keep a previous photo's failure.
  const [optimizerFailedSrc, setOptimizerFailedSrc] = useState<string | undefined>();
  const [missingSrc, setMissingSrc] = useState<string | undefined>();
  const optimizerFailed = Boolean(resolved && optimizerFailedSrc === resolved);
  const missing = Boolean(resolved && missingSrc === resolved);
  const optimized = Boolean(resolved && isOptimizableImageSrc(resolved) && !optimizerFailed);

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {resolved && optimized && !missing ? (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes}
          // 402 from /_next/image is an image error. Fall through to the file URL
          // instead of leaving the sand frame empty.
          onError={() => setOptimizerFailedSrc(resolved)}
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
          {...(priority
            ? { preload: true, fetchPriority: "high" as const }
            : { loading: "lazy" as const })}
        />
      ) : resolved && !missing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setMissingSrc(resolved)}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : null}
    </div>
  );
}
