export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

// Foreground color for emphasized values (KPIs, scores).
export const toneText: Record<Tone, string> = {
  neutral: 'text-ink',
  brand: 'text-brand-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  info: 'text-info-700',
};

// Solid fill for bars, dots and indicators.
export const toneFill: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  brand: 'bg-brand-600',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
  info: 'bg-info-600',
};

// Soft surface + border for banners and highlighted rows.
export const toneSoft: Record<Tone, string> = {
  neutral: 'border-line bg-canvas',
  brand: 'border-brand-200 bg-brand-50',
  success: 'border-success-200 bg-success-50',
  warning: 'border-warning-200 bg-warning-50',
  danger: 'border-danger-200 bg-danger-50',
  info: 'border-info-200 bg-info-50',
};
