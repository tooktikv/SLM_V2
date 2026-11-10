import { useSyncExternalStore, type ReactNode } from 'react';
import { th, thPatterns } from './th';

export type Lang = 'en' | 'th';
const STORAGE_KEY = 'slm.lang';

function initialLang(): Lang {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'th' || requested === 'en') return requested;
  return localStorage.getItem(STORAGE_KEY) === 'th' ? 'th' : 'en';
}

let lang: Lang = initialLang();
document.documentElement.lang = lang;
const listeners = new Set<() => void>();

export const getLang = () => lang;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function setLang(next: Lang): void {
  lang = next;
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}

// English text is the key; anything without a Thai entry stays in English.
export function translate(text: string): string {
  if (lang === 'en' || !text) return text;
  const hit = Object.prototype.hasOwnProperty.call(th, text) ? th[text] : undefined;
  if (hit) return hit;
  for (const [pattern, build] of thPatterns) {
    const match = pattern.exec(text);
    if (match) return build(match, translate);
  }
  return text;
}

// Translates plain-string children and leaves elements untouched.
export function tx(node: ReactNode): ReactNode {
  if (typeof node === 'string') return translate(node);
  if (Array.isArray(node)) return node.map(child => (typeof child === 'string' ? translate(child) : child));
  return node;
}

// Subscribes the calling component to language changes.
export function useT(): (text: string) => string {
  useSyncExternalStore(subscribe, getLang);
  return translate;
}

export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang);
