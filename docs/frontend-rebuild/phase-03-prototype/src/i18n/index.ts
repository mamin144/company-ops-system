// Public i18n surface. Screens import exclusively from '@/i18n' — never from
// setup/ or locales/ internals. Key parity is type-derived (TKey = keyof ar),
// so a missing translation in either locale is a compile error. The
// standardized {token} fill, RTL/LTR coordination and the `cos-proto-lang`
// persistence mechanism carry over from Phase 3 unchanged.
export type { Lang } from './direction';
export { PERSISTENCE_KEY, dirFor, applyLangDir } from './direction';
export { LangProvider, useLang } from './setup';
export type { TKey, TVars } from './setup';
