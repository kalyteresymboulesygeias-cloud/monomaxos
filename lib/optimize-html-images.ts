import { getImageProps } from "next/image";
import { IMAGE_SIZES, displayImageSrc, isOptimizableImageSrc, upgradeMediaSrc } from "@/lib/images";

const IMG_TAG = /<img\b[^>]*>/gi;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!match) return "";
  return decodeEntities(match[1] ?? match[2] ?? "");
}

function positiveInt(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 && n <= 16000 ? n : null;
}

function dimensions(tag: string) {
  const width = positiveInt(attr(tag, "width"));
  const height = positiveInt(attr(tag, "height"));
  if (width && height) return { width, height };
  const [rawWidth, rawHeight] = attr(tag, "data-orig-size").split(",");
  const origWidth = positiveInt((rawWidth ?? "").trim());
  const origHeight = positiveInt((rawHeight ?? "").trim());
  if (origWidth && origHeight) return { width: origWidth, height: origHeight };
  return null;
}

function contentSizes(width: number) {
  // Small embeds (author avatars) must not advertise a viewport width.
  if (width <= 400) return `${width}px`;
  return IMAGE_SIZES.article;
}

function replaceSrc(tag: string, src: string) {
  return tag.replace(/(^|\s)src\s*=\s*(?:"[^"]*"|'[^']*')/i, `$1src="${escapeAttr(src)}"`);
}

function fileTag(tag: string, rawSrc: string, src: string) {
  return src === rawSrc ? tag : replaceSrc(tag, src);
}

function stockWidth(width: number | null) {
  if (!width) return 960;
  if (width <= 800) return Math.min(960, width * 2);
  return Math.min(width, 1200);
}

function optimizeTag(tag: string) {
  const rawSrc = attr(tag, "src");
  if (!rawSrc) return tag;
  const dims = dimensions(tag);
  const src = displayImageSrc(upgradeMediaSrc(rawSrc), stockWidth(dims?.width ?? null));
  if (!dims || !isOptimizableImageSrc(src)) return fileTag(tag, rawSrc, src);
  try {
    const { props } = getImageProps({
      src,
      alt: attr(tag, "alt"),
      width: dims.width,
      height: dims.height,
      sizes: contentSizes(dims.width),
    });
    // images.unoptimized serves the file URL and leaves srcSet empty.
    // Keep the stored tag (https upgrade only) so article HTML does not
    // request /_next/image while the optimizer returns 402.
    if (!props.srcSet || !props.src?.includes("/_next/image")) return fileTag(tag, rawSrc, src);
    const className = attr(tag, "class");
    const classAttr = className ? ` class="${escapeAttr(className)}"` : "";
    const sizesAttr = props.sizes ? ` sizes="${escapeAttr(props.sizes)}"` : "";
    // If /_next/image fails, swap to the file. Clearing srcset stops the
    // browser from retrying the optimizer candidates.
    return `<img src="${escapeAttr(props.src)}" srcset="${escapeAttr(props.srcSet)}"${sizesAttr} width="${props.width}" height="${props.height}" alt="${escapeAttr(attr(tag, "alt"))}" loading="lazy" decoding="async"${classAttr} data-full-src="${escapeAttr(src)}" onerror="this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.fullSrc" />`;
  } catch {
    return fileTag(tag, rawSrc, src);
  }
}

/**
 * Article HTML is stored markup, so it cannot mount the Image component
 * without splitting parent tags. getImageProps is the same optimizer:
 * sized WebP/AVIF URLs when Image Optimization is enabled, with the original
 * tag left in place when the host is outside remotePatterns, the dimensions
 * are unknown, or images.unoptimized is set.
 */
export function optimizeArticleHtml(html: string) {
  if (!html.includes("<img")) return html;
  return html.replace(IMG_TAG, optimizeTag);
}
