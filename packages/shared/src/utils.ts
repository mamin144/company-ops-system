export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const includesNormalized = (source: string | undefined, query: string) => {
  if (!source) return false;
  return normalizeText(source).includes(normalizeText(query));
};

export const toNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};
