const EMBEDDED_BROWSER_PATTERN =
  /\bwv\b|webview|kakaotalk|naver|daumapps|instagram|fban|fbav|line\/|tiktok|snapchat|\bleo\b/i;

export function isEmbeddedOAuthBrowser(userAgent: string): boolean {
  if (EMBEDDED_BROWSER_PATTERN.test(userAgent)) return true;
  return /iphone|ipad|ipod/i.test(userAgent)
    && /applewebkit/i.test(userAgent)
    && !/safari/i.test(userAgent);
}

export function isAndroidBrowser(userAgent: string): boolean {
  return /android/i.test(userAgent);
}
