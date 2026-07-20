import type { Macros } from '@/shared/domain/types';

export type TimestampLike = { toDate(): Date };

export function timestampToISO(value: TimestampLike | string | null | undefined): string {
  if (value == null) {
    console.warn('timestampToISO: missing createdAt, defaulting to current time');
    return new Date().toISOString();
  }
  if (typeof value === 'string') return value;
  return value.toDate().toISOString();
}

export function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    console.warn(
      `requiredString: ${fieldName} is missing or not a string, defaulting to ''`,
      value,
    );
    return '';
  }
  return value;
}

export function requiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    console.warn(`requiredNumber: ${fieldName} is missing or not a number, defaulting to 0`, value);
    return 0;
  }
  return value;
}

export function requiredMacros(value: unknown, fieldName: string): Macros {
  if (value == null || typeof value !== 'object') {
    console.warn(
      `requiredMacros: ${fieldName} is missing or not an object, defaulting to zeroed macros`,
      value,
    );
    return { calories: 0, proteins: 0, fats: 0, carbs: 0 };
  }
  const macros = value as Record<string, unknown>;
  return {
    calories: requiredNumber(macros['calories'], `${fieldName}.calories`),
    proteins: requiredNumber(macros['proteins'], `${fieldName}.proteins`),
    fats: requiredNumber(macros['fats'], `${fieldName}.fats`),
    carbs: requiredNumber(macros['carbs'], `${fieldName}.carbs`),
  };
}
