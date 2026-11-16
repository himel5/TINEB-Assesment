const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'representatives.csv');

function parseCsv(text) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value.trim()); value = ''; if (row.some(Boolean)) rows.push(row); row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  const headers = rows.shift();
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

const rawRecords = parseCsv(fs.readFileSync(DATA_FILE, 'utf8'));
const records = rawRecords.map((record) => ({
  id: record['Sl.No.'], name: record.Name, party: record.Party, constituency: record.Constituency,
  state: record.State, status: record.Status,
  terms: record['Lok Sabha Terms'].split(',').map((term) => term.trim()).filter(Boolean),
  phone: record.Phone.trim() === '-' ? null : record.Phone,
  emails: record.Email.split(',').map((email) => email.trim()).filter(Boolean),
}));
const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const json = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); response.end(JSON.stringify(data)); };
const matchesState = (record, state) => normalize(record.state) === normalize(state);

/**
 * @openapi
 * /states:
 *   get:
 *     summary: Return the states represented in the dataset
 *     responses:
 *       200: { description: A list of state names }
 */
function statesRoute(response) { json(response, 200, [...new Set(records.map((record) => record.state))].sort().map((state) => ({ state }))); }

/**
 * @openapi
 * /constituencies:
 *   get:
 *     summary: Return constituencies, optionally filtered by state
 *     parameters:
 *       - { in: query, name: state, required: false, schema: { type: string } }
 *     responses:
 *       200: { description: A list of constituencies }
 *       400: { description: Missing or blank state parameter }
 */
function constituenciesRoute(response, state) {
  if (state !== undefined && !state.trim()) return json(response, 400, { error: 'The state parameter cannot be blank.' });
  if (state === undefined) return json(response, 200, records.map(({ constituency, state: recordState }) => ({ constituency, state: recordState })));
  json(response, 200, records.filter((record) => matchesState(record, state)).map(({ constituency, state: recordState }) => ({ constituency, state: recordState })));
}

/**
 * @openapi
 * /representatives:
 *   get:
 *     summary: Return representatives, optionally filtered by state or search term
 *     parameters:
 *       - { in: query, name: state, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: A list of representatives }
 */
function representativesRoute(response, query) {
  let result = records;
  if (query.has('state')) result = result.filter((record) => matchesState(record, query.get('state')));
  if (query.has('search')) { const term = normalize(query.get('search')); result = result.filter((record) => normalize(record.name).includes(term) || normalize(record.constituency).includes(term)); }
  json(response, 200, result);
}

/**
 * @openapi
 * /representatives/{id}:
 *   get:
 *     summary: Return one representative by Sl.No.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: A representative }
 *       404: { description: Representative not found }
 */
function representativeRoute(response, id) {
  const record = records.find((item) => String(item.id) === String(id));
  if (!record) return json(response, 404, { error: 'Representative not found.' });
  json(response, 200, record);
}

const openApi = {
  openapi: '3.0.0', info: { title: 'Representative Directory API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/states': { get: { summary: 'Return states data', responses: { 200: { description: 'States' } } } },
    '/constituencies': { get: { summary: 'Return constituencies data', responses: { 200: { description: 'Constituencies' }, 400: { description: 'Blank state' } } } },
    '/representatives': { get: { summary: 'Return representatives data', responses: { 200: { description: 'Representatives' } } } },
    '/representatives/{id}': { get: { summary: 'Return one representative', responses: { 200: { description: 'Representative' }, 404: { description: 'Not found' } } } },
  },
};

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) url.pathname = url.pathname.slice(4) || '/';
  if (url.pathname === '/openapi.json') return json(response, 200, openApi);
  if (url.pathname === '/api-docs') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return response.end('<!doctype html><title>API documentation</title><h1>Representative Directory API</h1><p>OpenAPI JSON: <a href="/openapi.json">/openapi.json</a></p><pre>GET /states\nGET /constituencies?state=Tamil%20Nadu\nGET /representatives?state=Tamil%20Nadu\nGET /representatives/:id</pre>'); }
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
  if (url.pathname === '/states') return statesRoute(response);
  if (url.pathname === '/constituencies') return constituenciesRoute(response, url.searchParams.get('state') === null ? undefined : url.searchParams.get('state'));
  if (url.pathname === '/representatives') return representativesRoute(response, url.searchParams);
  const representativeMatch = url.pathname.match(/^\/representatives\/([^/]+)$/);
  if (representativeMatch) return representativeRoute(response, decodeURIComponent(representativeMatch[1]));
  json(response, 404, { error: 'Route not found.' });
}

if (require.main === module) {
  http.createServer(handleRequest).listen(PORT, () => console.log(`Representative API listening on http://localhost:${PORT}`));
}

module.exports = handleRequest;
