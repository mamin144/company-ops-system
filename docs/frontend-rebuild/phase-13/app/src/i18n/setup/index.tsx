// Language provider (motion/i18n behavior identical to Phase 3).
// The dictionary was split verbatim into locales/ar.ts and locales/en.ts.
// `TKey` is still derived from the Arabic dictionary, so a missing English
// translation is a TypeScript error, exactly like before the split.
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ar } from '../locales/ar';
import { en } from '../locales/en';
import { PERSISTENCE_KEY, applyLangDir } from '../direction';

const dict = { ar, en } as const;

export type TKey = keyof (typeof dict)['ar'];
export type TVars = Record<string, string | number>;

/** Fills `{token}` placeholders. Unknown tokens are left as-is so a missing
    variable is visible instead of silently blank. (Phase 3 behavior.) */
const fill = (s: string, vars?: TVars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

const LangCtx = createContext<{ lang: 'ar' | 'en'; t: (k: TKey, vars?: TVars) => string; setLang: (l: 'ar' | 'en') => void }>({ lang: 'ar', t: (k) => k, setLang: () => {} });
export const useLang = () => useContext(LangCtx);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<'ar' | 'en'>(() => (localStorage.getItem(PERSISTENCE_KEY) === 'en' ? 'en' : 'ar'));
  useEffect(() => {
    applyLangDir(lang);
    localStorage.setItem(PERSISTENCE_KEY, lang);
    // Phase 5: the document title is user-facing chrome as well — flip it with
    // the language (the inline index.html restore covers first paint; this
    // keeps it correct after client-side switches).
    document.title = dict[lang].docTitle;
  }, [lang]);
  return <LangCtx.Provider value={{ lang, t: (k, vars) => fill(dict[lang][k], vars), setLang: setLangState }}>{children}</LangCtx.Provider>;
};
