import { join } from 'node:path';

export const apiRoot = process.cwd();
export const dataDir = join(apiRoot, 'data');
export const storageDir = join(apiRoot, 'storage');
export const tempDir = join(apiRoot, 'temp');
