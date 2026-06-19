/* 공연 host_organization 자유텍스트 표기 통일.
 *
 *   node normalize_host.js                 → 라이브 적용 (백업 후)
 *   node normalize_host.js --dry <out.js>  → 복사본에만 적용(검증용)
 *
 * 규칙(우선순위):
 *  1) 같은 정규화 키의 group 이 있으면 그 group_name(1단계 canonical)으로 맞춤
 *  2) 없으면, 변형이 2개 이상인 텍스트 군집은 최다 사용 표기로 맞춤
 *  3) 그 외(단일 표기 + 매칭 그룹 없음)는 그대로 둠
 */
const fs = require('fs');
const path = require('path');

const RDB_PATH = path.join(__dirname, 'kovox', 'data', 'kovox-rdb.js');
const argv = process.argv.slice(2);
const dryIdx = argv.indexOf('--dry');
const DRY = dryIdx !== -1;
const OUT = DRY ? argv[dryIdx + 1] : RDB_PATH;
const FIELD = 'host_organization';

function loadRdb(p) { let b = fs.readFileSync(p, 'utf8'); b = b.slice(b.indexOf('=') + 1).trim(); if (b.endsWith(';')) b = b.slice(0, -1); return JSON.parse(b); }
function norm(s) { if (!s) return ''; return String(s).toLowerCase().replace(/[\s ]+/g, '').replace(/\(주\)|（주）|㈜|주식회사|재단법인|\(재\)|（재）|사단법인|\(사\)|（사）|유한회사/g, '').replace(/[.,\-_/·•]/g, '').trim(); }

function main() {
  const rdb = loadRdb(RDB_PATH);

  // 1) 그룹 canonical 맵 (정규화키 -> group_name)
  const groupCanon = {};
  rdb.groups.forEach(g => { const k = norm(g.group_name); if (k && !groupCanon[k]) groupCanon[k] = g.group_name; });

  // 2) host 텍스트 군집 + 사용수
  const byKey = {};
  rdb.performances.forEach(p => { const v = p[FIELD]; if (!v) return; const k = norm(v); if (!k) return; (byKey[k] = byKey[k] || {})[v] = (byKey[k][v] || 0) + 1; });

  // 3) 키별 canonical 결정
  const canonOf = {};
  Object.keys(byKey).forEach(k => {
    if (groupCanon[k]) { canonOf[k] = groupCanon[k]; return; }          // 그룹 있으면 그 표기
    const variants = Object.entries(byKey[k]);
    if (variants.length > 1) canonOf[k] = variants.sort((a, b) => b[1] - a[1])[0][0]; // 최다 사용
  });

  // 4) 적용
  let changed = 0; const samples = [];
  rdb.performances.forEach(p => {
    const v = p[FIELD]; if (!v) return; const k = norm(v); const c = canonOf[k];
    if (c && c !== v) { if (samples.length < 12) samples.push(v + ' -> ' + c); p[FIELD] = c; changed++; }
  });

  if (!DRY) {
    const dir = path.join(__dirname, 'kovox', 'data', '_backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(RDB_PATH, path.join(dir, 'kovox-rdb.js.PRE-HOST-NORMALIZE.' + stamp + '.bak'));
  }
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, 'window.KOVOX_RDB = ' + JSON.stringify(rdb) + ';\n');
  fs.renameSync(tmp, OUT);

  const distinctAfter = new Set(rdb.performances.map(p => p[FIELD]).filter(Boolean)).size;
  console.log((DRY ? '[DRY] ' : '[APPLY] ') + FIELD + ' 변경된 공연: ' + changed + ' | 적용 후 고유 표기: ' + distinctAfter);
  console.log('샘플:'); samples.forEach(s => console.log('  ' + s));
  console.log('출력: ' + OUT);
}
main();
