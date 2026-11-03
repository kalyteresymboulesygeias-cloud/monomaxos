"use client";

import Image from "next/image";
import { useState } from "react";
import { isOptimizableImageSrc, upgradeMediaSrc } from "@/lib/images";

export default function CoverImage({
  src,
  alt,
  priority = false,
  className = "",
  sizes,
}: {
  src?: string;
  alt: string;
  /** LCP image: preload in <head> and fetchpriority=high. Everything else stays lazy. */
  priority?: boolean;
  className?: string;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = src ? upgradeMediaSrc(src) : undefined;
  const optimized = Boolean(resolved && isOptimizableImageSrc(resolved));

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {resolved && optimized && !failed ? (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes}
          onError={() => setFailed(true)}
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
          {...(priority
            ? { preload: true, fetchPriority: "high" as const }
            : { loading: "lazy" as const })}
        />
      ) : resolved && !optimized && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : null}
    </div>
  );
}
