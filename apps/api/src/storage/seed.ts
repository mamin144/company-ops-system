import { createId } from '../shared/id';

export const seedCategories = () => [
  { id: createId(), code: 'contracts', name: 'Contracts', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'boq', name: 'BOQ', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'drawings', name: 'Drawings', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'correspondence', name: 'Correspondence', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'reports', name: 'Reports', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'invoices', name: 'Invoices', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'technical-documents', name: 'Technical Documents', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'other', name: 'Other', group: 'document-category', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'doc-contract', name: 'Contract', group: 'document-type', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'doc-drawing', name: 'Drawing', group: 'document-type', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const seedUnits = () => [
  { id: createId(), code: 'pcs', name: 'Pieces', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'box', name: 'Box', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'kg', name: 'Kilogram', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'm', name: 'Meter', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: createId(), code: 'sqm', name: 'Square meter', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
