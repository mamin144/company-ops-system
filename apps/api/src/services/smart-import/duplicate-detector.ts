import type { Document } from '@cos/shared';

export interface DuplicateMatch {
  rowIndex: number;
  existingDocument: { id: string; title: string; documentNumber?: string };
  matchedOn: string;  // e.g. 'documentNumber + projectId'
}

export function detectDuplicates(
  rows: Record<string, unknown>[],
  existingDocuments: Document[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const documentNumber = row.documentNumber as string | undefined;
    const projectId = row.projectId as string | undefined;

    if (!documentNumber) {
      continue;
    }

    if (projectId) {
      // Check for documentNumber + projectId match
      const duplicate = existingDocuments.find(
        (d) => d.documentNumber === documentNumber && d.projectId === projectId
      );
      if (duplicate) {
        matches.push({
          rowIndex: i,
          existingDocument: {
            id: duplicate.id,
            title: duplicate.title,
            documentNumber: duplicate.documentNumber,
          },
          matchedOn: 'documentNumber + projectId',
        });
      }
    } else {
      // Check for global documentNumber match
      const duplicate = existingDocuments.find(
        (d) => d.documentNumber === documentNumber
      );
      if (duplicate) {
        matches.push({
          rowIndex: i,
          existingDocument: {
            id: duplicate.id,
            title: duplicate.title,
            documentNumber: duplicate.documentNumber,
          },
          matchedOn: 'documentNumber',
        });
      }
    }
  }

  return matches;
}
