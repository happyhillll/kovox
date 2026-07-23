/* KoVox 로컬 관리자 서버 (의존성 없음)
 *
 *   node serve.js
 *   → http://localhost:8000 접속
 *
 * - 사이트를 정적 서빙합니다.
 * - POST /api/edit 로 들어온 수정값을 kovox/data/kovox-data.js / kovox-rdb.js 에
 *   직접 반영합니다. (쓰기 전 .bak 백업, 임시파일 후 rename 으로 원자적 저장)
 * - 편집 UI 자체는 localhost 에서만 노출되므로(admin.js), 공개 배포본에는 영향이 없습니다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8000;

const DATA_FILES = {
  data: { path: path.join(ROOT, 'kovox', 'data', 'kovox-data.js'), varName: 'window.KOVOX_DATA' },
  rdb:  { path: path.join(ROOT, 'kovox', 'data', 'kovox-rdb.js'),  varName: 'window.KOVOX_RDB'  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function parseDataFile(spec) {
  const raw = fs.readFileSync(spec.path, 'utf8');
  const eq = raw.indexOf('=');
  if (eq === -1) throw new Error('데이터 파일 형식을 인식할 수 없습니다: ' + spec.path);
  let body = raw.slice(eq + 1).trim();
  if (body.endsWith(';')) body = body.slice(0, -1).trim();
  return JSON.parse(body);
}

const BACKUP_DIR = path.join(ROOT, 'kovox', 'data', '_backups');
function writeDataFile(spec, obj) {
  const tmp = spec.path + '.tmp';
  // 1) 직전 상태 백업 (.bak)
  try { fs.copyFileSync(spec.path, spec.path + '.bak'); } catch (_) { /* 첫 저장 */ }
  // 2) 타임스탬프 백업 — 절대 덮어쓰지 않음. 세션 내내 모든 저장 시점을 보존한다.
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const base = path.basename(spec.path);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(spec.path, path.join(BACKUP_DIR, base + '.' + stamp + '.bak'));
    const mine = fs.readdirSync(BACKUP_DIR).filter(f => f.indexOf(base + '.') === 0).sort();
    while (mine.length > 120) { try { fs.unlinkSync(path.join(BACKUP_DIR, mine.shift())); } catch (_) {} }
  } catch (_) {}
  // 3) 원자적 저장
  fs.writeFileSync(tmp, spec.varName + ' = ' + JSON.stringify(obj) + ';\n');
  fs.renameSync(tmp, spec.path);
}

/* edits: [{ store, collection, key, match, set }]
 *   store      : 'data' | 'rdb'
 *   collection : 'performances' | 'persons' | 'works' | 'programs' ...
 *   op         : 'set'(기본) | 'delete' | 'insert'
 *   key        : (set/delete) 매칭 필드명 (예: 'id', 'person_id', 'program_item_id')
 *   match      : (set/delete) 값 (문자열) 또는 값 배열
 *   set        : (set) { 필드: 값, ... }  (대상 행에 Object.assign)
 *   rows       : (insert) 추가할 행 객체 또는 객체 배열
 */
function applyEdits(edits) {
  const loaded = {};
  const touched = {};
  for (const e of edits) {
    const spec = DATA_FILES[e.store];
    if (!spec) throw new Error('알 수 없는 store: ' + e.store);
    if (!loaded[e.store]) loaded[e.store] = parseDataFile(spec);
    const coll = loaded[e.store][e.collection];
    if (!Array.isArray(coll)) throw new Error('알 수 없는 collection: ' + e.collection);
    const op = e.op || 'set';

    if (op === 'insert') {
      const rows = Array.isArray(e.rows) ? e.rows : [e.rows];
      if (rows.length === 0 || rows.some(r => !r || typeof r !== 'object')) throw new Error('insert rows 가 잘못되었습니다: ' + e.collection);
      for (const r of rows) coll.push(r);
    } else if (op === 'delete') {
      let pred;
      if (e.where && typeof e.where === 'object') {
        // 복합 조건: where 의 모든 필드가 일치하는 행 (예: perfGroups 의 performance_id+group_id+role)
        const keys = Object.keys(e.where);
        pred = (row) => keys.every(k => {
          const want = Array.isArray(e.where[k]) ? e.where[k].map(String) : [String(e.where[k])];
          return want.includes(String(row[k]));
        });
      } else {
        const matches = (Array.isArray(e.match) ? e.match : [e.match]).map(String);
        pred = (row) => matches.includes(String(row[e.key]));
      }
      const before = coll.length;
      loaded[e.store][e.collection] = coll.filter(row => !pred(row));
      if (loaded[e.store][e.collection].length === before && !e.allowEmpty) throw new Error('삭제할 행 없음: ' + e.collection + ' ' + JSON.stringify(e.where || (e.key + '=' + e.match)));
    } else if (op === 'mergePerson') {
      // 동명이인 통합: fromId 의 모든 participations 를 toId 로 이전(중복 제거) 후 fromId person 삭제
      const db = loaded[e.store];
      const from = e.fromId, to = e.toId;
      if (!from || !to || from === to) throw new Error('mergePerson: fromId/toId 가 잘못되었습니다');
      if (!Array.isArray(db.persons) || !Array.isArray(db.participations)) throw new Error('mergePerson: persons/participations 테이블이 없습니다');
      if (!db.persons.some(p => p.person_id === to)) throw new Error('mergePerson: 유지할 인물이 없습니다: ' + to);
      if (!db.persons.some(p => p.person_id === from)) throw new Error('mergePerson: 통합 대상 인물이 없습니다: ' + from);
      const seen = new Set(db.participations.filter(p => p.person_id === to).map(p => p.performance_id + '|' + p.program_item_id));
      const out = [];
      for (const p of db.participations) {
        if (p.person_id === from) {
          const k = p.performance_id + '|' + p.program_item_id;
          if (seen.has(k)) continue; // toId 가 이미 같은 항목에 참여 → 중복 제거
          seen.add(k);
          out.push(Object.assign({}, p, { person_id: to }));
        } else { out.push(p); }
      }
      db.participations = out;
      db.persons = db.persons.filter(p => p.person_id !== from);
    } else { // set
      const matches = (Array.isArray(e.match) ? e.match : [e.match]).map(String);
      let n = 0;
      for (const row of coll) {
        if (matches.includes(String(row[e.key]))) { Object.assign(row, e.set); n++; }
      }
      if (n === 0) throw new Error('일치하는 행 없음: ' + e.collection + '.' + e.key + ' = ' + JSON.stringify(e.match));
    }
    touched[e.store] = true;
  }
  for (const store of Object.keys(touched)) writeDataFile(DATA_FILES[store], loaded[store]);
  return { ok: true, stores: Object.keys(touched) };
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/edit') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e7) req.destroy(); });
    req.on('end', () => {
      try {
        const { edits } = JSON.parse(body);
        if (!Array.isArray(edits) || edits.length === 0) throw new Error('edits 가 비어 있습니다');
        const result = applyEdits(edits);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        console.log('[edit] %d건 적용 → %s', edits.length, result.stores.join(', '));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(err && err.message || err));
        console.error('[edit] 실패:', err && err.message || err);
      }
    });
    return;
  }

  // 정적 파일 서빙
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      // 디렉터리 URL(viewer/ 등)은 그 안의 index.html 로 (GitHub Pages 와 동일 동작)
      const idx = path.join(filePath, 'index.html');
      return fs.stat(idx, (e2, s2) => {
        if (e2 || !s2.isFile()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store, no-cache, must-revalidate' });
        fs.createReadStream(idx).pipe(res);
      });
    }
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    // 저장 후 새로고침 시 항상 최신 데이터/JSX 를 읽도록 캐시 비활성화 (로컬 편집 전용 서버)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('KoVox 로컬 관리자 서버 → http://localhost:' + PORT);
  console.log('편집 버튼은 localhost 에서만 보입니다. 저장 시 kovox/data/*.js 가 직접 수정됩니다 (.bak 백업 생성).');
});
