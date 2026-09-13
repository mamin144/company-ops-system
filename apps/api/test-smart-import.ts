import fs from 'fs';
import path from 'path';
import { signUserToken } from './src/middleware/auth.js';

async function run() {
  // Sign token
  const token = await signUserToken({ id: 'admin-123', username: 'admin', roleName: 'admin' });
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  console.log('--- STARTING SMART IMPORT TESTS ---');

  // We need to upload the file. We can construct a multipart/form-data request manually or use a library.
  // Since we are in node, using fetch with a manual multipart is easy if we construct the body.
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileBuffer = fs.readFileSync('test-smart-import.xlsx');
  
  const uploadBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const analyzeRes = await fetch('http://localhost:4001/api/import/smart/analyze', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: uploadBody
  });
  
  const analyzeData = await analyzeRes.json();
  console.log('Analyze Result Status:', analyzeRes.status);
  console.log('Available Sheets:', analyzeData.sheetNames);

  if (analyzeRes.status !== 200) {
    console.error('Analyze failed:', analyzeData);
    return;
  }

  // Next, preview on the second sheet (Mixed & Extra)
  const sheetName = 'Mixed & Extra';
  // Re-run analyze for specific sheet just to get mapping
  const uploadBodySheet2 = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="sheetName"\r\n\r\n${sheetName}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const analyzeRes2 = await fetch('http://localhost:4001/api/import/smart/analyze', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: uploadBodySheet2
  });
  const analyzeData2 = await analyzeRes2.json();
  const mappings = analyzeData2.mapping.mappings;

  // Let's force map 'Another Extra' to 'category'
  const categoryMapping = mappings.find((m: any) => m.excelHeader === 'Another Extra');
  if (categoryMapping) categoryMapping.systemField = 'category';

  console.log('Mappings from Analyze:', mappings.map((m: any) => `${m.excelHeader} -> ${m.systemField} (${m.confidence})`));

  const mappingStr = JSON.stringify(mappings);

  const previewBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="sheetName"\r\n\r\n${sheetName}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="mapping"\r\n\r\n${mappingStr}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const previewRes = await fetch('http://localhost:4001/api/import/smart/preview', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: previewBody
  });
  
  const previewData = await previewRes.json();
  console.log('Preview Result Status:', previewRes.status);
  console.log('Valid Rows:', previewData.validRows?.length);
  console.log('Invalid Rows:', previewData.invalidRows?.length);
  if (previewData.invalidRows?.length) console.log('First invalid reason:', previewData.invalidRows[0].errors);
  console.log('Warnings:', previewData.warnings?.length);
  console.log('Duplicates:', previewData.duplicates?.length);
  if (previewData.validRows && previewData.validRows.length > 0) {
    console.log('Sample Extra Data saved to notes:', previewData.validRows[0].notes);
  }

  // Now Confirm Import
  const confirmRes = await fetch('http://localhost:4001/api/import/smart/confirm', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: previewData.validRows,
      duplicateIndices: previewData.duplicates.map((d: any) => d.rowIndex)
    })
  });

  const confirmData = await confirmRes.json();
  console.log('Confirm Result Status:', confirmRes.status);
  console.log('Confirm Response:', confirmData);

  // Now test Admin Deletion
  // Get all documents
  const docsRes = await fetch('http://localhost:4001/api/documents', { headers });
  const docsData = await docsRes.json();
  const docsArray = Array.isArray(docsData) ? docsData : docsData.data || [];
  const docsToDelete = docsArray.filter((d: any) => d.documentNumber === 'DOC-002' || d.documentNumber === 'DOC-003');
  
  for (const doc of docsToDelete) {
    // try to delete
    console.log(`Trying to delete ${doc.documentNumber} (${doc.id}) with status ${doc.status}...`);
    const delRes = await fetch(`http://localhost:4001/api/documents/${doc.id}`, { method: 'DELETE', headers });
    if (delRes.status === 204) {
      console.log(`Success! Admin bypassed the delete blocker for document ${doc.id}`);
    } else {
      console.log(`Failed to delete (Admin):`, delRes.status, await delRes.text());
    }
  }
}

run().catch(console.error);
