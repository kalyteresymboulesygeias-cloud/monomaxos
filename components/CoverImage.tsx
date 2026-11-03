"use client";

import { useState } from "react";

export default function CoverImage({
  src,
  alt,
  priority = false,
  className = "",
  width,
  height,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`overflow-hidden bg-sand ${className}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : null}
    </div>
  );
}
