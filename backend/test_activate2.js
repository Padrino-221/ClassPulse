const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkRyLiBLd2FtZSBBc2FudGUiLCJlbWFpbCI6Imthc2FudGVAdW5pdmVyc2l0eS5lZHUiLCJyb2xlIjoibGVjdHVyZXIiLCJpYXQiOjE3ODQ3MzUwNzYsImV4cCI6MTc4NDc2Mzg3Nn0.BxaHauSi2CS8DulSQGNsHTBDjFP8u50EbPYiggWCESw';

// First, check if there's an existing active session blocking the insert
const check = {
  hostname: 'localhost', port: 5000, path: '/api/lecturer/sessions?limit=5&offset=0', method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
};
const r = http.request(check, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log('Sessions:', res.statusCode, b);
    
    // Now try activate with campus_id as string (like express-validator might see it)
    const d1 = JSON.stringify({ course_code: 'CS101', class_id: 1, week_number: 1, campus_id: 1 });
    const o1 = {
      hostname: 'localhost', port: 5000, path: '/api/lecturer/activate', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(d1),
        'Authorization': 'Bearer ' + token
      }
    };
    const r1 = http.request(o1, res2 => {
      let b2 = '';
      res2.on('data', c => b2 += c);
      res2.on('end', () => console.log('Activate:', res2.statusCode, b2));
    });
    r1.on('error', e => console.error(e.message));
    r1.write(d1);
    r1.end();
  });
});
r.on('error', e => console.error(e.message));
r.end();
