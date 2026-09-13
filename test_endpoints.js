
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    const zip = await post('/api/documents/export/zip', { documentIds: ['123'] });
    console.log('ZIP endpoint:', zip.status, zip.data.substring(0, 50));
    
    // Login to get token? Or the route is protected?
    // Wait, the routes have requirePermission('archive.read'). We need a token.
  } catch (e) {
    console.error(e);
  }
}
run();

