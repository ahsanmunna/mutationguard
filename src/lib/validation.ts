/**
 * Small, readable input checks used by API routes. Every helper throws a BadRequestError
 * (HTTP 400) with a clear message, so bad input never reaches the database.
 * Limits match the database columns (for example the audit ledger's entity_id is 50 characters).
 */
import { BadRequestError } from './errors';

/** A required, non-empty text field with a maximum length. */
export function requireText(body: any, key: string, maxLength = 100): string {
  const value = body?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestError(`Field "${key}" is required.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new BadRequestError(`Field "${key}" must be at most ${maxLength} characters.`);
  }
  return text;
}

/** An optional text field: missing means an empty string; present values are length-checked. */
export function optionalText(body: any, key: string, maxLength = 100): string {
  const value = body?.[key];
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new BadRequestError(`Field "${key}" must be text.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new BadRequestError(`Field "${key}" must be at most ${maxLength} characters.`);
  }
  return text;
}

/** A required number greater than zero (area in decimal), with an upper limit. */
export function requirePositiveNumber(body: any, key: string, max = 100000): number {
  const raw = body?.[key];
  const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) {
    throw new BadRequestError(`Field "${key}" must be a positive number.`);
  }
  return value;
}

/** A required calendar date written as YYYY-MM-DD (and a real date, not 2026-02-31). */
export function requireIsoDate(body: any, key: string): string {
  const value = body?.[key];
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new BadRequestError(`Field "${key}" must be a date in YYYY-MM-DD format.`);
  }
  const text = value.trim();
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new BadRequestError(`Field "${key}" is not a valid date.`);
  }
  return text;
}