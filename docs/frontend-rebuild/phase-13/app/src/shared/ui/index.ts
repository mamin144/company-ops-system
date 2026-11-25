// Public shared-UI surface. Import shared UI from '@/shared/ui' (or deep
// paths for icons/bits when explicitness helps). Nothing here may import from
// features/ or app/ — shared stays dependency-free of business modules.
export * from './ui';
export * from './icons';
export * from './ContextualExport';
