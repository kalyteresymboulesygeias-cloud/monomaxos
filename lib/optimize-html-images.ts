import { getImageProps } from "next/image";
import { IMAGE_SIZES, isOptimizableImageSrc, upgradeMediaSrc } from "@/lib/images";

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

function optimizeTag(tag: string) {
  const dims = dimensions(tag);
  const rawSrc = attr(tag, "src");
  if (!dims || !rawSrc) return tag;
  const src = upgradeMediaSrc(rawSrc);
  if (!isOptimizableImageSrc(src)) return tag;
  try {
    const { props } = getImageProps({
      src,
      alt: attr(tag, "alt"),
      width: dims.width,
      height: dims.height,
      sizes: contentSizes(dims.width),
    });
    if (!props.srcSet || !props.src.includes("/_next/image")) return tag;
    const className = attr(tag, "class");
    const classAttr = className ? ` class="${escapeAttr(className)}"` : "";
    const sizesAttr = props.sizes ? ` sizes="${escapeAttr(props.sizes)}"` : "";
    return `<img src="${escapeAttr(props.src)}" srcset="${escapeAttr(props.srcSet)}"${sizesAttr} width="${props.width}" height="${props.height}" alt="${escapeAttr(attr(tag, "alt"))}" loading="lazy" decoding="async"${classAttr} />`;
  } catch {
    return tag;
  }
}

/**
 * Article HTML is stored markup, so it cannot mount the Image component
 * without splitting parent tags. getImageProps is the same optimizer:
 * sized WebP/AVIF URLs, with the original tag left in place when the host
 * is outside remotePatterns or the dimensions are unknown.
 */
export function optimizeArticleHtml(html: string) {
  if (!html.includes("<img")) return html;
  return html.replace(IMG_TAG, optimizeTag);
}
