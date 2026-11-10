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
  syncDom();
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

// Safety net for text that is rendered without translate()/tx(): while Thai is on, every plain text node and the
// placeholder / aria-label / title attributes are translated in place, and restored when switching back to English.
const THAI = /[\u0E00-\u0E7F]/;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
const ATTRS = ['placeholder', 'aria-label', 'title'];
const originalText = new WeakMap<Text, string>();
const shownText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Record<string, string>>();

function localizeText(node: Text): void {
  const value = node.nodeValue ?? '';
  if (shownText.get(node) === value) return;
  const trimmed = value.trim();
  const parent = node.parentElement;
  if (!trimmed || THAI.test(trimmed) || !parent || SKIP_TAGS.has(parent.tagName) || (parent.tagName === 'OPTION' && !parent.hasAttribute('value'))) return;
  const translated = translate(trimmed);
  if (translated === trimmed) return;
  const next = value.replace(trimmed, translated);
  originalText.set(node, value);
  shownText.set(node, next);
  node.nodeValue = next;
}

function localizeAttrs(element: Element): void {
  for (const name of ATTRS) {
    const value = element.getAttribute(name);
    if (!value || THAI.test(value)) continue;
    const translated = translate(value.trim());
    if (translated === value.trim()) continue;
    originalAttrs.set(element, { ...originalAttrs.get(element), [name]: value });
    element.setAttribute(name, translated);
  }
}

function localizeTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { localizeText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  localizeAttrs(root as Element);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) localizeText(node as Text); else localizeAttrs(node as Element);
  }
}

function restoreTree(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const original = originalText.get(node as Text);
      if (original !== undefined) { node.nodeValue = original; originalText.delete(node as Text); shownText.delete(node as Text); }
    } else {
      const saved = originalAttrs.get(node as Element);
      if (saved) { Object.entries(saved).forEach(([name, value]) => (node as Element).setAttribute(name, value)); originalAttrs.delete(node as Element); }
    }
  }
}

const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') localizeText(record.target as Text);
    else if (record.type === 'attributes') localizeAttrs(record.target as Element);
    else record.addedNodes.forEach(localizeTree);
  }
});

function syncDom(): void {
  if (lang === 'th') {
    localizeTree(document.body);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  } else {
    observer.disconnect();
    restoreTree(document.body);
  }
}

if (document.body) syncDom(); else document.addEventListener('DOMContentLoaded', syncDom);
