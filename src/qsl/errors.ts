export type QslErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'INVALID_TRANSITION' | 'DUPLICATE';

export class QslError extends Error {
  code: QslErrorCode;
  details: string[];
  constructor(code: QslErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = 'QslError';
    this.code = code;
    this.details = details;
  }
}

// A function declaration (not a const arrow) so TypeScript narrows control flow after calls to it.
export function fail(code: QslErrorCode, message: string, details?: string[]): never {
  throw new QslError(code, message, details);
}

export function requireValid(errors: string[], message = 'Validation failed'): void {
  if (errors.length) throw new QslError('VALIDATION', `${message}: ${errors[0]}`, errors);
}
