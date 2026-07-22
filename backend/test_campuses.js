const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibmFtZSI6IkRyLiBLd2FtZSBBc2FudGUiLCJlbWFpbCI6Imthc2FudGVAdW5pdmVyc2l0eS5lZHUiLCJyb2xlIjoibGVjdHVyZXIiLCJpYXQiOjE3ODQ3MzUwNzYsImV4cCI6MTc4NDc2Mzg3Nn0.BxaHauSi2CS8DulSQGNsHTBDjFP8u50EbPYiggWCESw';

// Try campuses endpoint first
const o = {
  hostname: 'localhost', port: 5000, path: '/api/lecturer/campuses', method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token }
};
const r = http.request(o, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('Campuses:', res.statusCode, b));
});
r.on('error', e => console.error(e.message));
r.end();
