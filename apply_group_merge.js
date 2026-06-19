/* group_merge_review.csv 를 읽어 groups/perfGroups 를 병합한다.
 *
 *   node apply_group_merge.js                 → 라이브 kovox-rdb.js 에 적용 (백업 후)
 *   node apply_group_merge.js --dry <out.js>  → 복사본에만 적용(검증용), 라이브 미변경
 *
 * 동작: merge=Y 군집마다 group_ids[0](최다 사용)을 canonical 로 유지하고
 *  - canonical 그룹 이름을 canonical_name 으로 설정
 *  - 나머지 그룹을 가리키는 perfGroups 를 canonical 로 재연결
 *  - (performance_id, group_id, role) 중복 perfGroups 정리
 *  - 나머지(중복) 그룹 레코드 삭제
 */
const fs = require('fs');
const path = require('path');

const RDB_PATH = path.join(__dirname, 'kovox', 'data', 'kovox-rdb.js');
const CSV_PATH = path.join(__dirname, 'group_merge_review.csv');

const argv = process.argv.slice(2);
const dryIdx = argv.indexOf('--dry');
const DRY = dryIdx !== -1;
const OUT = DRY ? argv[dryIdx + 1] : RDB_PATH;

function loadRdb(p) { let b = fs.readFileSync(p, 'utf8'); b = b.slice(b.indexOf('=') + 1).trim(); if (b.endsWith(';')) b = b.slice(0, -1); return JSON.parse(b); }
function parseCSV(t) { const rows = []; let row = [], f = '', i = 0, q = false; while (i < t.length) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; } if (c === '"') { q = true; i++; continue; } if (c === ',') { row.push(f); f = ''; i++; continue; } if (c === '\r') { i++; continue; } if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; } f += c; i++; } if (f.length || row.length) { row.push(f); rows.push(row); } return rows; }

function main() {
  const rdb = loadRdb(RDB_PATH);
  const csv = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  const H = csv[0].map(x => x.trim());
  const col = {}; H.forEach((h, i) => col[h] = i);
  const groupById = {}; rdb.groups.forEach(g => { groupById[g.group_id] = g; });

  const remap = {}; const toDelete = new Set(); let renamed = 0, clusters = 0;
  for (let r = 1; r < csv.length; r++) {
    const row = csv[r]; if (!row || !row[col.group_ids]) continue;
    if (String(row[col.merge] || '').trim().toUpperCase() !== 'Y') continue;
    const ids = String(row[col.group_ids]).split('|').filter(Boolean);
    if (ids.length < 2) continue;
    const canonId = ids[0]; if (!groupById[canonId]) continue;
    const name = (row[col.canonical_name] || '').trim();
    clusters++;
    if (name && groupById[canonId].group_name !== name) { groupById[canonId].group_name = name; renamed++; }
    ids.slice(1).forEach(d => { remap[d] = canonId; toDelete.add(d); });
  }

  let repointed = 0;
  rdb.perfGroups.forEach(pg => { if (remap[pg.group_id]) { pg.group_id = remap[pg.group_id]; repointed++; } });

  let dedup = 0; const seen = new Set(); const newPG = [];
  rdb.perfGroups.forEach(pg => { const k = pg.performance_id + '|' + pg.group_id + '|' + pg.role; if (seen.has(k)) { dedup++; return; } seen.add(k); newPG.push(pg); });
  rdb.perfGroups = newPG;

  const beforeG = rdb.groups.length;
  rdb.groups = rdb.groups.filter(g => !toDelete.has(g.group_id));
  const deleted = beforeG - rdb.groups.length;

  // 무결성 검증
  const gset = new Set(rdb.groups.map(g => g.group_id));
  const dangling = rdb.perfGroups.filter(pg => !gset.has(pg.group_id)).length;

  // 백업 (라이브 적용 시)
  if (!DRY) {
    const dir = path.join(__dirname, 'kovox', 'data', '_backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(RDB_PATH, path.join(dir, 'kovox-rdb.js.PRE-GROUP-MERGE.' + stamp + '.bak'));
  }
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, 'window.KOVOX_RDB = ' + JSON.stringify(rdb) + ';\n');
  fs.renameSync(tmp, OUT);

  console.log((DRY ? '[DRY] ' : '[APPLY] ') + 'clusters=' + clusters + ' renamed=' + renamed + ' repointed=' + repointed + ' dedup=' + dedup + ' deleted=' + deleted);
  console.log('groups: ' + beforeG + ' -> ' + rdb.groups.length + ' | perfGroups: ' + rdb.perfGroups.length + ' | 끊긴 perfGroup→group: ' + dangling + (dangling === 0 ? ' ✅' : ' ✗'));
  console.log('출력: ' + OUT);
}
main();
