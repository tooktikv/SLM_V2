// Helpers for the "Fill sample data" shortcuts used while demoing the create dialogs.
export const isoInDays = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Each press moves on to the next item so repeated presses give different data.
export const cycle = <T,>(list: T[], index: number): T => list[index % list.length];
