import { describe, expect, it } from 'vitest';
import { isAndroidBrowser, isEmbeddedOAuthBrowser } from '../src/lib/browser-environment';

describe('mobile OAuth browser detection', () => {
  it('detects Android WebView and common in-app browsers', () => {
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (Linux; Android 15; wv) AppleWebKit/537.36 Chrome/130 Mobile')).toBe(true);
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 KAKAOTALK 11.2.0 Android')).toBe(true);
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 NAVER(inapp; search; 2000; 12.9.1) Android')).toBe(true);
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (Linux; Android 15) Leo/1.0 WebView')).toBe(true);
  });

  it('detects an iOS embedded WebView without blocking Safari', () => {
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148')).toBe(true);
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('allows normal Android browsers to continue to Google', () => {
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')).toBe(false);
    expect(isEmbeddedOAuthBrowser('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125 Mobile Safari/537.36')).toBe(false);
    expect(isAndroidBrowser('Mozilla/5.0 (Linux; Android 15)')).toBe(true);
  });
});
