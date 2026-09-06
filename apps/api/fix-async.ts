import fs from 'fs';
import path from 'path';

function walk(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

walk('apps/api/src', (filePath) => {
  if (filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;
    
    // Add async to routers
    const newContent = content.replace(/(get|post|put|patch|delete)\('([^']+)',\s*(?:requireAuth,\s*)?(?:requirePermission\('[^']+'\),\s*)?(?:upload\.single\('[^']+'\),\s*)?\(?(req|res|_req)[^=]*=>/g, (match, p1, p2, p3) => {
      if (match.includes('async')) return match;
      return match.replace('(req', 'async (req').replace('(_req', 'async (_req');
    });

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`Updated ${filePath}`);
    }
  }
});
