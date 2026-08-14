/**
 * URL sanitization for untrusted strings (event data, external feeds).
 * Only https: (and same-origin relative) URLs are allowed — everything else
 * returns a safe fallback. Prevents javascript: and other scheme injection.
 */

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

export function sanitizeUrl(value: string | null | undefined): string {
  if (!value) return '';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return '';
  // Deny credentials in URLs
  if (url.username || url.password) return '';
  return url.toString();
}

/** Absolute image src that the CSP img-src permits (https:). */
export function sanitizeImageUrl(value: string | null | undefined): string {
  const url = sanitizeUrl(value);
  if (!url.startsWith('https:')) return '';
  return url;
}
