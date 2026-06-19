/* global React */
/* KoVox — 공연 정보 편집 페이지 (#/edit/<id>)
 * Contribute 페이지와 닮은 폼. 기존 데이터를 미리 채우고, 저장 시 변경분만 /api/edit
 * (set/insert/delete) 로 적용. 자체 완결형 — window.KOVOX_DATA / KOVOX_RDB / KovoxAdmin + React.
 */
(function () {
  if (!window.React) return;
  var React = window.React;
  var useState = React.useState;

  var C = { coral: 'var(--coral, #f57b6b)', ink: 'var(--ink, #efe9e0)', soft: 'var(--ink-soft, #a09888)', rule: 'var(--rule, #3a3735)', deep: 'var(--bg-deep, #161412)' };
  var input = { width: '100%', padding: '11px 13px', fontSize: 14, background: C.deep, border: '1px solid ' + C.rule, color: C.ink, fontFamily: 'Pretendard, sans-serif', outline: 'none', boxSizing: 'border-box' };
  var labelS = { font: '500 10px/1 ui-monospace, monospace', color: C.soft, letterSpacing: '0.15em', display: 'block', marginBottom: 6 };
  var sectionS = { font: '600 12px/1 ui-monospace, monospace', color: C.coral, letterSpacing: '0.25em', margin: '34px 0 16px' };
  var btn = { font: '500 12px/1 ui-monospace, monospace', letterSpacing: '0.04em', padding: '8px 13px', cursor: 'pointer', borderRadius: 4, border: '1px solid ' + C.rule, background: 'transparent', color: C.soft };
  function pbtn() { return Object.assign({}, btn, { background: C.coral, color: '#fff', border: '1px solid ' + C.coral }); }
  function dashed(col) { return Object.assign({}, btn, { borderStyle: 'dashed', color: col || C.coral, borderColor: col || C.coral }); }
  var resultRow = { padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid ' + C.rule, fontSize: 14 };

  var keyCounter = 0;
  function mkKey() { keyCounter += 1; return 'k' + keyCounter; }
  function newId(p) { return p + Date.now() + '_' + Math.floor(Math.random() * 100000); }
  function toInputDate(s) { return (s || '').replace(/\./g, '-'); }
  function toDotDate(s) { return (s || '').replace(/-/g, '.'); }
  function mbComposerOf(w) {
    if (w.relations) { var c = w.relations.find(function (r) { return r.type === 'composer'; }); if (c && c.artist) return c.artist.name; }
    if (w['artist-credit'] && w['artist-credit'][0]) return w['artist-credit'][0].name;
    return '';
  }
  function searchMB(q) {
    return fetch('https://musicbrainz.org/ws/2/work?query=' + encodeURIComponent(q) + '&fmt=json&limit=15&inc=artist-rels')
      .then(function (r) { return r.json(); }).then(function (d) { return d.works || []; });
  }

  function loadOriginal(perfId) {
    var D = window.KOVOX_DATA || { performances: [] };
    var R = window.KOVOX_RDB || { performances: [], persons: [], programs: [], works: [], participations: [], groups: [], perfGroups: [] };
    var fullPerfId = 'PERF_' + perfId;
    var dataPerf = (D.performances || []).find(function (p) { return String(p.id) === String(perfId); });
    var rdbPerf = (R.performances || []).find(function (p) { return p.performance_id === fullPerfId; });
    if (!dataPerf && !rdbPerf) return null;

    var personById = {}; (R.persons || []).forEach(function (p) { personById[p.person_id] = p; });
    var workById = {}; (R.works || []).forEach(function (w) { workById[w.work_id] = w; });
    var groupById = {}; (R.groups || []).forEach(function (g) { groupById[g.group_id] = g; });

    var parts = (R.participations || []).filter(function (pa) { return pa.performance_id === fullPerfId; });
    var pids = []; parts.forEach(function (pa) { if (pids.indexOf(pa.person_id) === -1) pids.push(pa.person_id); });
    var persons = pids.map(function (id) { return personById[id]; }).filter(Boolean);
    function perfRow(p) { return { _k: mkKey(), person_id: p.person_id, name: p.person_name || '', medium: p.person_medium || '', profile: p.person_profile || '' }; }
    var singers = persons.filter(function (p) { return p.person_role === 'main performer'; }).map(perfRow);
    var accompanists = persons.filter(function (p) { return p.person_role === 'accompanist'; }).map(perfRow);

    var pgs = (R.perfGroups || []).filter(function (pg) { return pg.performance_id === fullPerfId; });
    function groupRows(role) {
      return pgs.filter(function (pg) { return pg.role === role; }).map(function (pg) {
        var g = groupById[pg.group_id]; return { _k: mkKey(), group_id: pg.group_id, group_name: g ? g.group_name : pg.group_id };
      });
    }
    var hostGroups = groupRows('Host'), sponsorGroups = groupRows('Sponsor');

    var progs = (R.programs || []).filter(function (pr) { return pr.performance_id === fullPerfId; })
      .sort(function (a, b) { return (Number(a.program_order) || 0) - (Number(b.program_order) || 0); });
    var program = progs.map(function (pr) {
      if (pr.is_intermission === 'TRUE') return { _k: mkKey(), program_item_id: pr.program_item_id, isIntermission: true };
      var w = pr.work_id ? workById[pr.work_id] : null;
      return { _k: mkKey(), program_item_id: pr.program_item_id, work_id: pr.work_id || null, isIntermission: false,
        title: w ? (w.mb_title || w.title_variant || '') : '', composer: w ? (w.mb_composer || '') : '', language: w ? (w.mb_language || '') : '' };
    });

    return {
      perfId: perfId, fullPerfId: fullPerfId, hasRdb: !!rdbPerf,
      personById: personById, workById: workById,
      origPersonIds: pids.slice(),
      origProgramItemIds: progs.map(function (pr) { return pr.program_item_id; }),
      origHostIds: hostGroups.map(function (g) { return g.group_id; }),
      origSponsorIds: sponsorGroups.map(function (g) { return g.group_id; }),
      meta: {
        title: (dataPerf && dataPerf.title) || (rdbPerf && rdbPerf.performance_title) || '',
        date: toInputDate((dataPerf && dataPerf.date) || (rdbPerf && rdbPerf.performance_date) || ''),
        startTime: (rdbPerf && rdbPerf.start_time) || (dataPerf && dataPerf.time) || '',
        durationMinutes: (rdbPerf && rdbPerf.duration_minutes) ? String(rdbPerf.duration_minutes) : '',
        venue: (dataPerf && dataPerf.venue) || (rdbPerf && rdbPerf.venue_name) || '',
      },
      singers: singers, accompanists: accompanists, hostGroups: hostGroups, sponsorGroups: sponsorGroups, program: program,
    };
  }

  function buildEdits(orig, meta, singers, accompanists, hostGroups, sponsorGroups, program) {
    var edits = [];
    var fp = orig.fullPerfId;

    var composers = [];
    program.forEach(function (it) { if (!it.isIntermission && it.composer && it.composer !== 'Unknown' && composers.indexOf(it.composer) === -1) composers.push(it.composer); });

    // 공연 스칼라 (host/sponsor 는 그룹으로 관리하므로 여기선 안 건드림)
    edits.push({ store: 'data', collection: 'performances', key: 'id', match: orig.perfId, set: { title: meta.title, date: toDotDate(meta.date), time: meta.startTime, venue: meta.venue, composers: composers } });
    var rdbSet = { performance_title: meta.title, performance_date: meta.date, start_time: meta.startTime || null, duration_minutes: meta.durationMinutes ? parseInt(meta.durationMinutes, 10) : null, venue_name: meta.venue };
    if (orig.hasRdb) edits.push({ store: 'rdb', collection: 'performances', key: 'performance_id', match: fp, set: rdbSet });
    else { var prow = { performance_id: fp, mt20id: null, host_organization: null, sponsoring_organization: null }; for (var kk in rdbSet) prow[kk] = rdbSet[kk]; edits.push({ store: 'rdb', collection: 'performances', op: 'insert', rows: prow }); }

    // 연주자
    var current = singers.map(function (r) { return { r: r, role: 'main performer' }; }).concat(accompanists.map(function (r) { return { r: r, role: 'accompanist' }; }));
    var curPids = {}; current.forEach(function (c) { if (c.r.person_id) curPids[c.r.person_id] = 1; });
    orig.origPersonIds.forEach(function (pid) { if (!curPids[pid]) edits.push({ store: 'rdb', collection: 'participations', op: 'delete', where: { performance_id: fp, person_id: pid }, allowEmpty: true }); });
    current.forEach(function (c) {
      var r = c.r; if (!r.name.trim()) return;
      if (r.person_id) {
        var o = orig.personById[r.person_id] || {}; var set = {};
        if (r.name !== (o.person_name || '')) set.person_name = r.name;
        if (r.medium !== (o.person_medium || '')) set.person_medium = r.medium || null;
        if (r.profile !== (o.person_profile || '')) set.person_profile = r.profile || null;
        if (c.role !== o.person_role) set.person_role = c.role;
        if (Object.keys(set).length) edits.push({ store: 'rdb', collection: 'persons', key: 'person_id', match: r.person_id, set: set });
        if (orig.origPersonIds.indexOf(r.person_id) === -1) edits.push({ store: 'rdb', collection: 'participations', op: 'insert', rows: { performance_id: fp, program_item_id: fp + '_PART_' + newId(''), person_id: r.person_id } });
      } else {
        var npid = newId('PERSON_USER_');
        edits.push({ store: 'rdb', collection: 'persons', op: 'insert', rows: { person_id: npid, person_name: r.name, person_role: c.role, person_medium: r.medium || null, person_profile: r.profile || null, person_isni: null } });
        edits.push({ store: 'rdb', collection: 'participations', op: 'insert', rows: { performance_id: fp, program_item_id: fp + '_PART_' + newId(''), person_id: npid } });
      }
    });

    // HOST / SPONSOR 그룹
    function reconcileGroups(list, origIds, role) {
      var curIds = {}; list.forEach(function (g) { if (g.group_id) curIds[g.group_id] = 1; });
      origIds.forEach(function (gid) { if (!curIds[gid]) edits.push({ store: 'rdb', collection: 'perfGroups', op: 'delete', where: { performance_id: fp, group_id: gid, role: role }, allowEmpty: true }); });
      list.forEach(function (g) {
        if (!g.group_name || !g.group_name.trim()) return;
        if (g.group_id) {
          if (origIds.indexOf(g.group_id) === -1) edits.push({ store: 'rdb', collection: 'perfGroups', op: 'insert', rows: { performance_id: fp, group_id: g.group_id, role: role } });
        } else {
          var gid = newId('GROUP_USER_');
          edits.push({ store: 'rdb', collection: 'groups', op: 'insert', rows: { group_id: gid, group_name: g.group_name.trim() } });
          edits.push({ store: 'rdb', collection: 'perfGroups', op: 'insert', rows: { performance_id: fp, group_id: gid, role: role } });
        }
      });
    }
    reconcileGroups(hostGroups, orig.origHostIds, 'Host');
    reconcileGroups(sponsorGroups, orig.origSponsorIds, 'Sponsor');

    // 프로그램
    var curItemIds = {};
    program.forEach(function (it, idx) {
      var order = idx + 1;
      if (it.program_item_id) curItemIds[it.program_item_id] = 1;
      if (it.isIntermission) {
        if (it.program_item_id) edits.push({ store: 'rdb', collection: 'programs', key: 'program_item_id', match: it.program_item_id, set: { program_order: order, is_intermission: 'TRUE', work_id: null } });
        else edits.push({ store: 'rdb', collection: 'programs', op: 'insert', rows: { program_item_id: newId('ITEM_USER_'), performance_id: fp, work_id: null, program_order: order, is_intermission: 'TRUE' } });
        return;
      }
      var workId = it.work_id;
      if (!workId) {
        workId = newId('WRK_USER_');
        edits.push({ store: 'rdb', collection: 'works', op: 'insert', rows: { work_id: workId, title_variant: it.title, mb_title: it.title, mb_type: null, mb_language: it.language || null, mb_composer: it.composer || null, mb_composer_birth_year: null, mb_composer_death_year: null, mb_lyricist: null, mbid: it.mbid || null, mb_parent_work_title: null, mbid_parent_work: null } });
      } else {
        var ow = orig.workById[workId] || {}; var ws = {};
        if (it.title !== (ow.mb_title || ow.title_variant || '')) ws.mb_title = it.title;
        if (it.composer !== (ow.mb_composer || '')) ws.mb_composer = it.composer || null;
        if (it.language !== (ow.mb_language || '')) ws.mb_language = it.language || null;
        if (it.mbid && it.mbid !== (ow.mbid || '')) ws.mbid = it.mbid;
        if (Object.keys(ws).length) edits.push({ store: 'rdb', collection: 'works', key: 'work_id', match: workId, set: ws });
      }
      if (it.program_item_id) edits.push({ store: 'rdb', collection: 'programs', key: 'program_item_id', match: it.program_item_id, set: { program_order: order, work_id: workId, is_intermission: 'FALSE' } });
      else edits.push({ store: 'rdb', collection: 'programs', op: 'insert', rows: { program_item_id: newId('ITEM_USER_'), performance_id: fp, work_id: workId, program_order: order, is_intermission: 'FALSE' } });
    });
    orig.origProgramItemIds.forEach(function (piid) {
      if (!curItemIds[piid]) {
        edits.push({ store: 'rdb', collection: 'programs', op: 'delete', key: 'program_item_id', match: piid });
        edits.push({ store: 'rdb', collection: 'participations', op: 'delete', key: 'program_item_id', match: piid, allowEmpty: true });
      }
    });
    return edits;
  }

  function editSummary(edits) { var s = { set: 0, insert: 0, del: 0 }; edits.forEach(function (e) { var op = e.op || 'set'; if (op === 'insert') s.insert++; else if (op === 'delete') s.del++; else s.set++; }); return s; }

  // ───────────────────────── 컴포넌트 ─────────────────────────
  function EditPerformance(props) {
    var origS = useState(function () { return loadOriginal(props.perfId); }); var orig = origS[0];
    var metaS = useState(function () { return orig ? Object.assign({}, orig.meta) : {}; }); var meta = metaS[0], setMeta = metaS[1];
    var sgS = useState(function () { return orig ? orig.singers.slice() : []; }); var singers = sgS[0], setSingers = sgS[1];
    var acS = useState(function () { return orig ? orig.accompanists.slice() : []; }); var accompanists = acS[0], setAcc = acS[1];
    var hgS = useState(function () { return orig ? orig.hostGroups.slice() : []; }); var hostGroups = hgS[0], setHost = hgS[1];
    var spS = useState(function () { return orig ? orig.sponsorGroups.slice() : []; }); var sponsorGroups = spS[0], setSponsor = spS[1];
    var pgS = useState(function () { return orig ? orig.program.slice() : []; }); var program = pgS[0], setProgram = pgS[1];
    var prevS = useState(null); var previewEdits = prevS[0], setPreviewEdits = prevS[1];
    var savingS = useState(false); var isSaving = savingS[0], setSaving = savingS[1];
    var errS = useState(''); var error = errS[0], setError = errS[1];
    var dragS = useState(null); var dragKey = dragS[0], setDragKey = dragS[1];
    var srchS = useState({ k: null, q: '', mb: [], loading: false }); var rowSearch = srchS[0], setRowSearch = srchS[1];
    var addS = useState({ q: '', mb: [], loading: false }); var add = addS[0], setAdd = addS[1];

    if (!orig) {
      return React.createElement('div', { style: { padding: 56, color: C.ink } },
        React.createElement('a', { href: '#/performances', style: { color: C.coral } }, '← PERFORMANCES'),
        React.createElement('p', null, '공연을 찾을 수 없습니다: ' + props.perfId));
    }
    var h = React.createElement;
    function setM(k, v) { setMeta(function (m) { var n = Object.assign({}, m); n[k] = v; return n; }); }
    function updRow(list, setList, k, field, v) { setList(list.map(function (r) { if (r._k !== k) return r; var n = Object.assign({}, r); n[field] = v; return n; })); }
    function patchRow(list, setList, k, patch) { setList(list.map(function (r) { return r._k === k ? Object.assign({}, r, patch) : r; })); }
    function removeRow(list, setList, k) { setList(list.filter(function (r) { return r._k !== k; })); }

    // ── 연주자 행 ──
    function performerRows(list, setList, roleLabel, mediumPh) {
      return list.map(function (r) {
        var sugg = [];
        if (!r.person_id && r.name && r.name.trim().length >= 1) {
          var ql = r.name.trim().toLowerCase(); var ppl = (window.KOVOX_RDB.persons || []);
          for (var i = 0; i < ppl.length && sugg.length < 6; i++) { if ((ppl[i].person_name || '').toLowerCase().indexOf(ql) !== -1) sugg.push(ppl[i]); }
        }
        return h('div', { key: r._k, style: { border: '1px solid ' + C.rule, borderRadius: 6, padding: 12, marginBottom: 10 } },
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 10, alignItems: 'end' } },
            h('div', { style: { position: 'relative' } },
              h('label', { style: labelS }, 'NAME' + (r.person_id ? ' · 기존 인물' : ' · 신규')),
              h('input', { value: r.name, style: input, placeholder: roleLabel + ' 이름 (기존 검색)', onChange: function (e) { updRow(list, setList, r._k, 'name', e.target.value); } }),
              sugg.length ? h('div', { style: { position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, border: '1px solid ' + C.coral, background: '#1f1d1b', maxHeight: 200, overflowY: 'auto' } },
                sugg.map(function (p) { return h('div', { key: p.person_id, style: resultRow, onClick: function () { patchRow(list, setList, r._k, { person_id: p.person_id, name: p.person_name, medium: p.person_medium || '', profile: p.person_profile || '' }); } }, p.person_name, h('span', { style: { color: C.soft, marginLeft: 8, fontSize: 11 } }, (p.person_role || '') + (p.person_medium ? ' · ' + p.person_medium : ''))); })) : null),
            h('div', null, h('label', { style: labelS }, 'VOICE/INSTRUMENT'), h('input', { value: r.medium, style: input, placeholder: mediumPh, onChange: function (e) { updRow(list, setList, r._k, 'medium', e.target.value); } })),
            h('button', { style: Object.assign({}, btn, { color: '#b91c1c', borderColor: '#b91c1c' }), onClick: function () { removeRow(list, setList, r._k); } }, '삭제')),
          h('div', { style: { marginTop: 8 } }, h('label', { style: labelS }, 'PROFILE / 프로필'),
            h('textarea', { value: r.profile, rows: 2, style: Object.assign({}, input, { resize: 'vertical' }), placeholder: '약력 (선택)', onChange: function (e) { updRow(list, setList, r._k, 'profile', e.target.value); } })),
          r.person_id ? h('div', { style: { marginTop: 4, font: '11px ui-monospace, monospace', color: C.soft } }, '⚠ 이름/약력/악기 수정은 이 인물의 모든 공연에 반영됩니다.') : null);
      });
    }
    function addPerformer(setList) { setList(function (l) { return l.concat([{ _k: mkKey(), person_id: null, name: '', medium: '', profile: '' }]); }); }

    // ── 곡 행: 드래그앤드롭 + 인라인 편집 + 행별 검색 ──
    function reorderTo(fromKey, toKey) {
      setProgram(function (l) { var from = l.findIndex(function (x) { return x._k === fromKey; }); var to = l.findIndex(function (x) { return x._k === toKey; }); if (from < 0 || to < 0 || from === to) return l; var c = l.slice(); var m = c.splice(from, 1)[0]; c.splice(to, 0, m); return c; });
    }
    function moveItem(k, dir) { setProgram(function (l) { var i = l.findIndex(function (x) { return x._k === k; }); var j = i + dir; if (i < 0 || j < 0 || j >= l.length) return l; var c = l.slice(); var t = c[i]; c[i] = c[j]; c[j] = t; return c; }); }
    function openRowSearch(k) { setRowSearch({ k: k, q: '', mb: [], loading: false }); }
    function runRowMb() { if (rowSearch.q.trim().length < 2) return; setRowSearch(function (s) { return Object.assign({}, s, { loading: true }); }); searchMB(rowSearch.q.trim()).then(function (rs) { setRowSearch(function (s) { return Object.assign({}, s, { mb: rs, loading: false }); }); }).catch(function () { setRowSearch(function (s) { return Object.assign({}, s, { mb: [], loading: false }); }); }); }
    function rowExistingResults() {
      if (rowSearch.q.trim().length < 2) return [];
      var ql = rowSearch.q.trim().toLowerCase(); var ws = (window.KOVOX_RDB.works || []); var out = [];
      for (var i = 0; i < ws.length && out.length < 8; i++) { var w = ws[i]; if (((w.mb_title || w.title_variant || '').toLowerCase().indexOf(ql) !== -1) || ((w.mb_composer || '').toLowerCase().indexOf(ql) !== -1)) out.push(w); }
      return out;
    }

    function programRows() {
      return program.map(function (it, idx) {
        var dragProps = {
          onDragOver: function (e) { e.preventDefault(); },
          onDrop: function (e) { e.preventDefault(); if (dragKey) reorderTo(dragKey, it._k); setDragKey(null); },
        };
        var handle = h('span', {
          draggable: true, title: '드래그하여 순서 변경',
          onDragStart: function () { setDragKey(it._k); },
          onDragEnd: function () { setDragKey(null); },
          style: { cursor: 'grab', color: C.soft, fontSize: 16, padding: '0 4px', userSelect: 'none' },
        }, '⠿');
        var rowBody = it.isIntermission
          ? h('div', { style: { flex: 1, font: '12px ui-monospace, monospace', color: C.soft, fontStyle: 'italic', paddingTop: 10 } }, '— INTERMISSION —')
          : h('div', { style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 84px', gap: 8 } },
              h('input', { value: it.title, style: input, placeholder: '곡 제목', onChange: function (e) { updRow(program, setProgram, it._k, 'title', e.target.value); } }),
              h('input', { value: it.composer, style: input, placeholder: '작곡가', onChange: function (e) { updRow(program, setProgram, it._k, 'composer', e.target.value); } }),
              h('input', { value: it.language, style: input, placeholder: '언어', onChange: function (e) { updRow(program, setProgram, it._k, 'language', e.target.value); } }));
        var children = [
          h('div', { key: 'top', style: { display: 'flex', gap: 8, alignItems: 'flex-start' } },
            handle,
            h('span', { style: { font: '12px ui-monospace, monospace', color: C.soft, width: 18, paddingTop: 10 } }, idx + 1),
            rowBody,
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
              h('button', { style: Object.assign({}, btn, { padding: '2px 6px' }), onClick: function () { moveItem(it._k, -1); } }, '▲'),
              h('button', { style: Object.assign({}, btn, { padding: '2px 6px' }), onClick: function () { moveItem(it._k, 1); } }, '▼')),
            it.isIntermission ? null : h('button', { style: Object.assign({}, btn, { whiteSpace: 'nowrap' }), onClick: function () { rowSearch.k === it._k ? setRowSearch({ k: null, q: '', mb: [], loading: false }) : openRowSearch(it._k); } }, '🔍 검색'),
            h('button', { style: Object.assign({}, btn, { color: '#b91c1c', borderColor: '#b91c1c' }), onClick: function () { removeRow(program, setProgram, it._k); } }, '×')),
        ];
        if (rowSearch.k === it._k && !it.isIntermission) {
          var exist = rowExistingResults();
          children.push(h('div', { key: 'search', style: { marginTop: 10, padding: 10, border: '1px solid ' + C.rule, borderRadius: 6, background: C.deep } },
            h('div', { style: { font: '11px ui-monospace, monospace', color: C.soft, marginBottom: 6 } }, '이 곡을 기존 곡/MusicBrainz 에서 가져오기'),
            h('input', { value: rowSearch.q, autoFocus: true, style: input, placeholder: '곡/작곡가 검색...', onChange: function (e) { var v = e.target.value; setRowSearch(function (s) { return Object.assign({}, s, { q: v }); }); }, onKeyDown: function (e) { if (e.key === 'Enter') runRowMb(); } }),
            exist.length ? h('div', { style: { marginTop: 6, border: '1px solid ' + C.rule, maxHeight: 180, overflowY: 'auto' } },
              h('div', { style: { font: '10px ui-monospace, monospace', color: C.soft, padding: '6px 10px' } }, '기존 곡'),
              exist.map(function (w) { return h('div', { key: w.work_id, style: resultRow, onClick: function () { patchRow(program, setProgram, it._k, { work_id: w.work_id, title: w.mb_title || w.title_variant || '', composer: w.mb_composer || '', language: w.mb_language || '' }); setRowSearch({ k: null, q: '', mb: [], loading: false }); } }, (w.mb_title || w.title_variant), h('span', { style: { color: C.soft, marginLeft: 8, fontSize: 11 } }, w.mb_composer || '')); })) : null,
            h('div', { style: { display: 'flex', gap: 8, marginTop: 8 } }, h('button', { style: pbtn(), onClick: runRowMb }, rowSearch.loading ? '...' : 'MusicBrainz 검색')),
            rowSearch.mb.length ? h('div', { style: { marginTop: 6, border: '1px solid #6bc5f5', maxHeight: 200, overflowY: 'auto' } },
              h('div', { style: { font: '10px ui-monospace, monospace', color: '#6bc5f5', padding: '6px 10px' } }, 'MUSICBRAINZ'),
              rowSearch.mb.map(function (w) { return h('div', { key: w.id, style: resultRow, onClick: function () { patchRow(program, setProgram, it._k, { title: w.title, composer: mbComposerOf(w), language: w.language || '', mbid: w.id }); setRowSearch({ k: null, q: '', mb: [], loading: false }); } }, w.title, h('span', { style: { color: C.soft, marginLeft: 8, fontSize: 11 } }, mbComposerOf(w))); })) : null));
        }
        return h('div', Object.assign({ key: it._k, style: { padding: 10, border: '1px solid ' + (dragKey === it._k ? C.coral : C.rule), borderRadius: 6, marginBottom: 8, background: dragKey === it._k ? 'rgba(245,123,107,0.06)' : 'transparent' } }, dragProps), children);
      });
    }

    // 하단 추가 도구
    function runAddMb() { var mq = (add.mbq || '').trim(); if (mq.length < 2) return; setAdd(function (s) { return Object.assign({}, s, { loading: true }); }); searchMB(mq).then(function (rs) { setAdd(function (s) { return Object.assign({}, s, { mb: rs, loading: false }); }); }).catch(function () { setAdd(function (s) { return Object.assign({}, s, { mb: [], loading: false }); }); }); }
    function addExistingWork(w) { setProgram(function (l) { return l.concat([{ _k: mkKey(), program_item_id: null, work_id: w.work_id, isIntermission: false, title: w.mb_title || w.title_variant || '', composer: w.mb_composer || '', language: w.mb_language || '' }]); }); setAdd({ q: '', mb: [], loading: false }); }
    function addMbWork(w) { setProgram(function (l) { return l.concat([{ _k: mkKey(), program_item_id: null, work_id: null, isIntermission: false, title: w.title, composer: mbComposerOf(w), language: w.language || '', mbid: w.id }]); }); setAdd({ q: '', mb: [], loading: false }); }
    function addBlankWork() { setProgram(function (l) { return l.concat([{ _k: mkKey(), program_item_id: null, work_id: null, isIntermission: false, title: '', composer: '', language: '' }]); }); }
    function addIntermission() { setProgram(function (l) { return l.concat([{ _k: mkKey(), program_item_id: null, isIntermission: true }]); }); }
    var addExist = [];
    if (add.q.trim().length >= 2) { var aql = add.q.trim().toLowerCase(); var aws = (window.KOVOX_RDB.works || []); for (var ai = 0; ai < aws.length && addExist.length < 8; ai++) { var aw = aws[ai]; if (((aw.mb_title || aw.title_variant || '').toLowerCase().indexOf(aql) !== -1) || ((aw.mb_composer || '').toLowerCase().indexOf(aql) !== -1)) addExist.push(aw); } }

    function doPreview() { setError(''); try { setPreviewEdits(buildEdits(orig, meta, singers, accompanists, hostGroups, sponsorGroups, program)); } catch (e) { setError('변경 계산 실패: ' + (e && e.message || e)); } }
    function doApply() { if (!previewEdits) return; setSaving(true); setError(''); window.KovoxAdmin.save(previewEdits).then(function () { window.location.hash = '#/detail/' + orig.perfId; window.location.reload(); }).catch(function (e) { setError('저장 실패: ' + (e && e.message || e)); setSaving(false); }); }
    var sum = previewEdits ? editSummary(previewEdits) : null;

    return h('div', { style: { width: '100%', maxWidth: 1000, margin: '0 auto', minHeight: '100vh', padding: '0 56px 140px', color: C.ink } },
      h('div', { style: { padding: '24px 0', borderBottom: '1px solid ' + C.rule, marginBottom: 8 } },
        h('a', { href: '#/detail/' + orig.perfId, style: { font: '500 11px/1 ui-monospace, monospace', color: C.soft, letterSpacing: '0.15em', textDecoration: 'none' } }, '← 취소하고 공연으로 돌아가기')),
      h('h1', { style: { fontSize: 40, letterSpacing: '-0.03em', margin: '8px 0 4px' } }, '공연 정보 수정'),
      h('div', { style: { font: '12px ui-monospace, monospace', color: C.soft } }, '№ ' + orig.perfId + (orig.hasRdb ? '' : ' · (RDB 레코드 없음 — 저장 시 생성)')),

      h('div', { style: sectionS }, '● PERFORMANCE INFO'),
      h('div', null, h('label', { style: labelS }, 'TITLE / 공연 제목'), h('input', { value: meta.title, style: input, onChange: function (e) { setM('title', e.target.value); } })),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 } },
        h('div', null, h('label', { style: labelS }, 'DATE'), h('input', { type: 'date', value: meta.date, style: input, onChange: function (e) { setM('date', e.target.value); } })),
        h('div', null, h('label', { style: labelS }, 'START'), h('input', { value: meta.startTime, style: input, placeholder: '19:30', onChange: function (e) { setM('startTime', e.target.value); } })),
        h('div', null, h('label', { style: labelS }, 'DURATION(MIN)'), h('input', { type: 'number', value: meta.durationMinutes, style: input, onChange: function (e) { setM('durationMinutes', e.target.value); } })),
        h('div', null, h('label', { style: labelS }, 'VENUE'), h('input', { value: meta.venue, style: input, onChange: function (e) { setM('venue', e.target.value); } }))),

      h('div', { style: sectionS }, '● SINGER / 성악가'),
      performerRows(singers, setSingers, '성악가', '예: soprano'),
      h('button', { style: dashed(), onClick: function () { addPerformer(setSingers); } }, '+ SINGER 추가'),

      h('div', { style: sectionS }, '● ACCOMPANIST / 반주자'),
      performerRows(accompanists, setAcc, '반주자', '예: piano'),
      h('button', { style: dashed(), onClick: function () { addPerformer(setAcc); } }, '+ ACCOMPANIST 추가'),

      h('div', { style: sectionS }, '● HOST / 주최'),
      React.createElement(GroupEditor, { list: hostGroups, setList: setHost, role: 'Host', label: '주최' }),
      h('div', { style: sectionS }, '● SPONSOR / 후원'),
      React.createElement(GroupEditor, { list: sponsorGroups, setList: setSponsor, role: 'Sponsor', label: '후원' }),

      h('div', { style: sectionS }, '● PROGRAMME / 프로그램'),
      h('div', { style: { font: '11px ui-monospace, monospace', color: C.soft, marginBottom: 10 } }, '⠿ 핸들을 드래그하여 순서 변경 · 🔍 로 기존 곡/MusicBrainz 검색 가져오기'),
      programRows(),
      program.length === 0 ? h('div', { style: { font: '12px ui-monospace, monospace', color: C.soft, marginBottom: 10 } }, '프로그램이 없습니다. 아래에서 곡을 추가하세요.') : null,
      h('div', { style: { marginTop: 8 } }, h('label', { style: labelS }, '+ 곡 추가 — 기존 곡 검색'),
        h('input', { value: add.q, style: input, placeholder: '곡 제목 또는 작곡가 검색...', onChange: function (e) { var v = e.target.value; setAdd(function (s) { return Object.assign({}, s, { q: v }); }); } }),
        addExist.length ? h('div', { style: { border: '1px solid ' + C.rule, maxHeight: 200, overflowY: 'auto', background: C.deep, marginTop: 4 } }, addExist.map(function (w) { return h('div', { key: w.work_id, style: resultRow, onClick: function () { addExistingWork(w); } }, (w.mb_title || w.title_variant), h('span', { style: { color: C.soft, marginLeft: 8, fontSize: 11 } }, w.mb_composer || '')); })) : null),
      h('div', { style: { marginTop: 12 } }, h('label', { style: labelS }, '+ 곡 추가 — MusicBrainz 검색'),
        h('div', { style: { display: 'flex', gap: 8 } },
          h('input', { value: add.mbq || '', style: Object.assign({}, input, { flex: 1 }), placeholder: 'MusicBrainz 검색...', onChange: function (e) { var v = e.target.value; setAdd(function (s) { return Object.assign({}, s, { mbq: v }); }); }, onKeyDown: function (e) { if (e.key === 'Enter') runAddMb(); } }),
          h('button', { style: pbtn(), onClick: runAddMb }, add.loading ? '...' : '검색')),
        add.mb && add.mb.length ? h('div', { style: { border: '1px solid #6bc5f5', maxHeight: 240, overflowY: 'auto', background: C.deep, marginTop: 4 } }, add.mb.map(function (w) { return h('div', { key: w.id, style: resultRow, onClick: function () { addMbWork(w); } }, w.title, h('span', { style: { color: C.soft, marginLeft: 8, fontSize: 11 } }, mbComposerOf(w))); })) : null),
      h('div', { style: { display: 'flex', gap: 10, marginTop: 12 } },
        h('button', { style: btn, onClick: addBlankWork }, '+ 직접 입력'),
        h('button', { style: btn, onClick: addIntermission }, '+ INTERMISSION')),

      // 하단 고정 저장 바
      h('div', { style: { position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(31,29,27,0.96)', borderTop: '1px solid ' + C.rule, padding: '14px 56px', display: 'flex', justifyContent: 'flex-end', gap: 12, zIndex: 50 } },
        error ? h('span', { style: { color: '#ff8a8a', font: '12px ui-monospace, monospace', alignSelf: 'center', marginRight: 'auto' } }, error) : h('span', { style: { marginRight: 'auto' } }),
        h('a', { href: '#/detail/' + orig.perfId, style: Object.assign({}, btn, { textDecoration: 'none', alignSelf: 'center' }) }, '취소'),
        h('button', { style: Object.assign({}, pbtn(), { padding: '12px 26px', fontSize: 14 }), onClick: doPreview }, '변경사항 저장')),

      // 확인 모달
      previewEdits ? h('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }, onClick: function () { if (!isSaving) setPreviewEdits(null); } },
        h('div', { style: { width: 560, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', background: '#1f1d1b', border: '1px solid ' + C.coral, borderRadius: 8, padding: 24 }, onClick: function (e) { e.stopPropagation(); } },
          h('div', { style: { font: '600 12px/1 ui-monospace, monospace', color: C.coral, letterSpacing: '0.2em', marginBottom: 14 } }, '변경 사항 확인'),
          (sum.set + sum.insert + sum.del === 0)
            ? h('div', { style: { color: C.soft } }, '변경 사항이 없습니다.')
            : h('div', null,
                h('div', { style: { font: '14px ui-monospace, monospace', color: C.ink, marginBottom: 10 } }, '수정 ' + sum.set + ' · 추가 ' + sum.insert + ' · 삭제 ' + sum.del),
                h('div', { style: { maxHeight: 260, overflowY: 'auto', font: '11px/1.7 ui-monospace, monospace', color: C.soft, border: '1px solid ' + C.rule, borderRadius: 4, padding: 10 } },
                  previewEdits.map(function (e, i) { var op = e.op || 'set'; return h('div', { key: i }, '· [' + op + '] ' + e.collection + (e.set ? ' ‹' + Object.keys(e.set).join(',') + '›' : '') + (op === 'delete' ? ' ✕' : '')); }))),
          h('div', { style: { display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' } },
            h('button', { style: btn, onClick: function () { setPreviewEdits(null); } }, '다시 편집'),
            h('button', { style: Object.assign({}, pbtn(), { padding: '12px 24px' }), disabled: isSaving || (sum.set + sum.insert + sum.del === 0), onClick: doApply }, isSaving ? '저장 중...' : '확인하고 저장')))) : null);
  }

  // ── HOST/SPONSOR 그룹 편집기 ──
  function GroupEditor(props) {
    var h = React.createElement;
    var qS = useState(''); var q = qS[0], setQ = qS[1];
    var list = props.list, setList = props.setList;
    var sugg = [];
    if (q.trim()) { var ql = q.trim().toLowerCase(); var gs = (window.KOVOX_RDB.groups || []); var have = {}; list.forEach(function (g) { if (g.group_id) have[g.group_id] = 1; }); for (var i = 0; i < gs.length && sugg.length < 8; i++) { if (!have[gs[i].group_id] && (gs[i].group_name || '').toLowerCase().indexOf(ql) !== -1) sugg.push(gs[i]); } }
    function addExisting(g) { setList(function (l) { return l.concat([{ _k: mkKey(), group_id: g.group_id, group_name: g.group_name }]); }); setQ(''); }
    function addNew() { if (!q.trim()) return; setList(function (l) { return l.concat([{ _k: mkKey(), group_id: null, group_name: q.trim() }]); }); setQ(''); }
    function remove(k) { setList(function (l) { return l.filter(function (x) { return x._k !== k; }); }); }
    return h('div', null,
      list.length ? h('div', { style: { marginBottom: 8 } }, list.map(function (g) {
        return h('span', { key: g._k, style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', marginRight: 6, marginBottom: 6, border: '1px solid ' + C.rule, borderRadius: 14, fontSize: 13 } },
          g.group_name, g.group_id ? null : h('span', { style: { color: C.coral, fontSize: 10 } }, '신규'),
          h('button', { title: '제거', style: { background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 13, padding: 0 }, onClick: function () { remove(g._k); } }, '✕'));
      })) : null,
      h('div', { style: { position: 'relative', maxWidth: 460 } },
        h('div', { style: { display: 'flex', gap: 8 } },
          h('input', { value: q, style: Object.assign({}, input, { flex: 1 }), placeholder: '기존 ' + props.label + ' 검색 또는 새 이름 입력...', onChange: function (e) { setQ(e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') addNew(); } }),
          h('button', { style: pbtn(), onClick: addNew }, '＋ 새 ' + props.label)),
        sugg.length ? h('div', { style: { position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, border: '1px solid ' + C.coral, background: '#1f1d1b', maxHeight: 200, overflowY: 'auto' } },
          sugg.map(function (g) { return h('div', { key: g.group_id, style: resultRow, onClick: function () { addExisting(g); } }, g.group_name); })) : null));
  }

  window.KoVoxEdit = { EditPerformance: EditPerformance };
})();
