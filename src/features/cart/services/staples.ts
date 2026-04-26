export const BASIC_KEYWORDS = [
  'соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло',
  'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа',
] as const;

export function isStaple(name: string): boolean {
  const lower = name.toLowerCase();
  return BASIC_KEYWORDS.some((k) => lower.includes(k));
}
