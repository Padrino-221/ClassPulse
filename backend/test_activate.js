const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkRyLiBLd2FtZSBBc2FudGUiLCJlbWFpbCI6Imthc2FudGVAdW5pdmVyc2l0eS5lZHUiLCJyb2xlIjoibGVjdHVyZXIiLCJpYXQiOjE3ODQ3MzUwNzYsImV4cCI6MTc4NDc2Mzg3Nn0.BxaHauSi2CS8DulSQGNsHTBDjFP8u50EbPYiggWCESw';
const d = JSON.stringify({ course_code: 'CS101', class_id: 1, week_number: 1, campus_id: 1 });
const o = {
  hostname: 'localhost', port: 5000, path: '/api/lecturer/activate', method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(d),
    'Authorization': 'Bearer ' + token
  }
};
const r = http.request(o, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log(res.statusCode, b));
});
r.on('error', e => console.error(e.message));
r.write(d);
r.end();
