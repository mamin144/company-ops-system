// Direction handling for the bilingual prototype (Phase 4 foundation).
// Arabic is the default language and renders RTL; English renders LTR.
// The persistence key and persistence mechanism are unchanged from Phase 3.

export type Lang = 'ar' | 'en';

/** localStorage key for the language choice (same as Phase 3). */
export const PERSISTENCE_KEY = 'cos-proto-lang';

/** Reading direction for a language — never hardcoded call sites. */
export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/* Locale-display convention (Phase 3.12, B-14 — documented, tested):
   · Identifiers and contract codes (PRJ-004, DOC-220, MR-012, emails) render
     EXACTLY as stored — never reformatted, never translated, direction-isolated.
   · Quantities, money and displayed dates use Western digits (en-US
     formatting); the stored ISO values are never mutated for display.
   · Arabic-Indic digits can still appear from two sources this app does not
     control: user-entered business data (e.g. an item name) and the browser's
     native date-input rendering. Both are left as-is by design. */

/** Applies `lang` and the matching `dir` to the document root. Called from the
    language provider on every language change so `lang`/`dir` are always
    coordinated (same behavior as Phase 3, now factored out). */
export const applyLangDir = (lang: Lang) => {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirFor(lang);
};
