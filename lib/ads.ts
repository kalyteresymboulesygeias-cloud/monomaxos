/** Publisher id. Auto ads needs only this; the layout loads adsbygoogle.js. */
export function adsenseClient() {
  const value = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  return value || undefined;
}

export function adSlotId(slot?: string) {
  const value = slot?.trim();
  return value || undefined;
}

/**
 * A manual unit paints when its slot id is set.
 * With a client and no slot, paint nothing so Auto ads is not boxed in by a placeholder.
 * Without a client, keep the layout placeholder.
 */
export function adSlotVisible(slot?: string) {
  if (!adsenseClient()) return true;
  return Boolean(adSlotId(slot));
}
