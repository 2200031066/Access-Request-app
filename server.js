// Access Request app: zero-dependency Node.js server (Node 18+).
// Data is stored in data/requests.json. Every request carries an append-only history.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'requests.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SYSTEMS = ['GitHub', 'AWS', 'Slack', 'Google Workspace'];
const ROLES = ['Employee', 'Manager'];

// ---------- storage ----------
function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function save(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// ---------- helpers ----------
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
});
const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// ---------- business logic (exported for tests) ----------
function createRequest(list, { name, system, reason }) {
  name = clean(name); reason = clean(reason);
  if (!name) return { error: 'Name is required.' };
  if (!SYSTEMS.includes(system)) return { error: `System must be one of: ${SYSTEMS.join(', ')}.` };
  if (!reason) return { error: 'Reason is required.' };
  const now = new Date().toISOString();
  const r = {
    id: crypto.randomUUID(), name, system, reason, status: 'Pending', createdAt: now,
    history: [{ action: 'Created', by: name, at: now, note: reason }],
  };
  list.push(r);
  return { request: r };
}

function decide(list, id, { role, actor, decision, comment }) {
  if (role !== 'Manager') return { error: 'Only a manager can approve or reject.', code: 403 };
  const r = list.find((x) => x.id === id);
  if (!r) return { error: 'Request not found.', code: 404 };
  if (r.status !== 'Pending') return { error: `Request is already ${r.status}.`, code: 409 };
  if (!['Approved', 'Rejected'].includes(decision)) return { error: 'Decision must be Approved or Rejected.' };
  comment = clean(comment); actor = clean(actor) || 'Manager';
  if (decision === 'Rejected' && !comment) return { error: 'A reason is required when rejecting.' };
  const now = new Date().toISOString();
  r.status = decision;
  r.history.push({ action: decision, by: actor, at: now, note: comment });
  return { request: r };
}

// ---------- routes ----------
async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','requests',id,'decision']
  const role = req.headers['x-role'];
  const actor = req.headers['x-user'];
  if (!ROLES.includes(role)) return send(res, 400, { error: 'Missing or invalid X-Role header.' });

  if (parts[1] !== 'requests') return send(res, 404, { error: 'Not found.' });
  const list = load();

  if (req.method === 'GET' && parts.length === 2) {
    // Employees see only their own requests; managers see everything.
    const out = role === 'Manager' ? list : list.filter((r) => r.name.toLowerCase() === clean(actor).toLowerCase());
    return send(res, 200, out.slice().reverse());
  }
  if (req.method === 'POST' && parts.length === 2) {
    const body = await readBody(req);
    const out = createRequest(list, body);
    if (out.error) return send(res, 400, out);
    save(list);
    return send(res, 201, out.request);
  }
  if (req.method === 'POST' && parts.length === 4 && parts[3] === 'decision') {
    const body = await readBody(req);
    const out = decide(list, parts[2], { role, actor, decision: body.decision, comment: body.comment });
    if (out.error) return send(res, out.code || 400, { error: out.error });
    save(list);
    return send(res, 200, out.request);
  }
  send(res, 404, { error: 'Not found.' });
}

function serveStatic(req, res, url) {
  const file = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) { send(res, 400, { error: e.message }); }
});

if (require.main === module) server.listen(PORT, () => console.log(`Access Requests running at http://localhost:${PORT}`));
module.exports = { createRequest, decide, SYSTEMS };
