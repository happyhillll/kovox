/* KoVox 인라인 편집 (로컬 관리자 전용)
 *
 * - localhost / 127.0.0.1 에서 접속했을 때만 활성화됩니다. 공개 사이트에서는 아무 동작도 하지 않습니다.
 * - 저장은 serve.js 의 POST /api/edit 로 전송되어 kovox/data/*.js 를 직접 수정한 뒤 페이지를 새로고침합니다.
 *   (새로고침 시 RDB 인덱스가 다시 빌드되므로 composer/singer 등 엔티티 연결이 자동으로 일관됩니다.)
 */
(function () {
  var KovoxAdmin = {
    enabled: ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1,
  };

  KovoxAdmin.save = function (edits) {
    return fetch('/api/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits: edits }),
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t); });
      return res.json();
    });
  };

  // 저장 후 새로고침 (데이터/인덱스 재빌드 → 엔티티 연결 일관성 보장)
  KovoxAdmin.applyAndReload = function (edits) {
    return KovoxAdmin.save(edits).then(function () {
      location.reload();
    }).catch(function (e) {
      alert('저장 실패: ' + (e && e.message || e));
    });
  };

  // 기존 composer 정규 이름 목록 (자동완성 + 연결 확인용)
  KovoxAdmin.composerNames = function () {
    if (!window.KOVOX_RDB || !window.KOVOX_RDB.works) return [];
    var seen = {};
    window.KOVOX_RDB.works.forEach(function (w) { if (w.mb_composer) seen[w.mb_composer] = 1; });
    return Object.keys(seen).sort();
  };

  // 곡(work)이 지금까지 프로그램에 몇 번 올랐는지 (누적 사용 횟수). 페이지당 1회 계산 후 캐시.
  KovoxAdmin._workUsage = null;
  KovoxAdmin.workUsage = function (workId) {
    if (!KovoxAdmin._workUsage) {
      var m = {}; var progs = (window.KOVOX_RDB && window.KOVOX_RDB.programs) || [];
      progs.forEach(function (pr) { if (pr.work_id && pr.is_intermission !== 'TRUE') m[pr.work_id] = (m[pr.work_id] || 0) + 1; });
      KovoxAdmin._workUsage = m;
    }
    return KovoxAdmin._workUsage[workId] || 0;
  };

  var BTN = {
    font: '500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: '0.05em', color: '#c2410c', background: 'transparent',
    border: '1px solid #c2410c', borderRadius: 4, padding: '3px 8px',
    cursor: 'pointer', marginLeft: 8, verticalAlign: 'middle', whiteSpace: 'nowrap',
  };
  function primary(extra) {
    var s = {}; for (var k in BTN) s[k] = BTN[k];
    s.background = '#c2410c'; s.color = '#fff'; s.marginLeft = 0;
    if (extra) for (var j in extra) s[j] = extra[j];
    return s;
  }
  function plain(extra) {
    var s = {}; for (var k in BTN) s[k] = BTN[k];
    s.marginLeft = 0;
    if (extra) for (var j in extra) s[j] = extra[j];
    return s;
  }

  function defineWidgets() {
    var React = window.React;
    if (!React) return;
    var h = React.createElement;
    var useState = React.useState;

    // 인라인 텍스트 편집기 (single line / textarea)
    function Editable(props) {
      var st = useState(false), editing = st[0], setEditing = st[1];
      var vs = useState(props.value || ''), val = vs[0], setVal = vs[1];
      if (!KovoxAdmin.enabled) return null;
      if (!editing) {
        return h('button', {
          style: BTN,
          onClick: function () { setVal(props.value || ''); setEditing(true); },
        }, '✎ ' + (props.label || 'edit'));
      }
      var field = props.multiline
        ? h('textarea', {
            value: val, rows: props.rows || 5,
            style: { width: '100%', minWidth: 340, font: '14px/1.6 sans-serif', padding: 8, boxSizing: 'border-box' },
            onChange: function (e) { setVal(e.target.value); },
          })
        : h('input', {
            value: val,
            style: { width: '100%', minWidth: 340, font: '14px sans-serif', padding: 8, boxSizing: 'border-box' },
            onChange: function (e) { setVal(e.target.value); },
          });
      return h('div', { style: { margin: '8px 0', maxWidth: 560 } },
        props.hint ? h('div', { style: { font: '11px ui-monospace, monospace', color: '#8a8478', marginBottom: 4 } }, props.hint) : null,
        field,
        h('div', { style: { marginTop: 6, display: 'flex', gap: 8 } },
          h('button', { style: primary(), onClick: function () { props.onSave(val); } }, '저장'),
          h('button', { style: plain(), onClick: function () { setEditing(false); } }, '취소')
        )
      );
    }

    // composer 편집기 (기존 이름 자동완성 → 정규 이름에 자동 연결)
    function ComposerPicker(props) {
      var st = useState(false), editing = st[0], setEditing = st[1];
      var vs = useState(''), val = vs[0], setVal = vs[1];
      if (!KovoxAdmin.enabled) return null;
      if (!editing) {
        return h('button', {
          style: BTN,
          onClick: function () { setVal(props.current === 'Unknown' ? '' : (props.current || '')); setEditing(true); },
        }, '✎ composer');
      }
      var names = KovoxAdmin.composerNames();
      var matched = names.indexOf(val.trim()) !== -1;
      return h('div', { style: { margin: '8px 0' } },
        h('input', {
          list: 'kovox-composer-list', value: val,
          placeholder: '작곡가명 입력 (기존 이름 자동완성)',
          style: { width: 380, font: '14px sans-serif', padding: 8 },
          onChange: function (e) { setVal(e.target.value); },
        }),
        h('datalist', { id: 'kovox-composer-list' },
          names.map(function (n) { return h('option', { key: n, value: n }); })),
        h('div', { style: { marginTop: 6, display: 'flex', gap: 8 } },
          h('button', { style: primary(), onClick: function () { if (val.trim()) props.onSave(val.trim()); } }, '저장 & 연결'),
          h('button', { style: plain(), onClick: function () { setEditing(false); } }, '취소')
        ),
        h('div', { style: { marginTop: 5, font: '11px ui-monospace, monospace', color: matched ? '#4a7' : '#a08' } },
          val.trim()
            ? (matched ? '✓ 기존 composer "' + val.trim() + '" 에 연결됩니다' : '⚠ 새 composer 로 생성됩니다 (기존 이름과 다름)')
            : '기존 작곡가명을 고르면 해당 composer 페이지에 연결됩니다')
      );
    }

    // ── MusicBrainz 헬퍼 (Contribute 와 동일 로직) ──────────────────
    function mbComposer(w) {
      if (w.relations) {
        var c = w.relations.find(function (r) { return r.type === 'composer'; });
        if (c && c.artist) return c.artist.name;
      }
      if (w['artist-credit'] && w['artist-credit'][0]) return w['artist-credit'][0].name;
      return '';
    }
    function searchMB(q) {
      return fetch('https://musicbrainz.org/ws/2/work?query=' + encodeURIComponent(q) + '&fmt=json&limit=25&inc=artist-rels')
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.works || []; });
    }

    // 후보를 "현재 적힌 composer 기준"으로 정렬: 일치(0) → 유사(1) → 나머지(2). 동점은 원래 순서 유지.
    function composerRank(target, cand) {
      if (!target) return 2;
      var t = String(target).trim().toLowerCase();
      var c = String(cand || '').trim().toLowerCase();
      if (!t || !c) return 2;
      if (c === t) return 0;
      if (c.indexOf(t) !== -1 || t.indexOf(c) !== -1) return 1; // 부분 일치 (표기 차이)
      var ts = t.split(/\s+/), cs = c.split(/\s+/);
      var tl = ts[ts.length - 1], cl = cs[cs.length - 1];
      if (tl && tl.length > 1 && tl === cl) return 1; // 성(姓) 일치
      return 2;
    }
    function rankByComposer(list, target, getComposer) {
      return list.map(function (x, i) { return { x: x, i: i, r: composerRank(target, getComposer(x)) }; })
        .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
        .map(function (o) { return o.x; });
    }
    var MAX_RESULTS = 200; // 스크롤로 전체 탐색하되 렌더 폭주 방지
    var SCROLLBOX = { maxWidth: 460, maxHeight: 320, overflowY: 'auto', WebkitOverflowScrolling: 'touch' };

    var TAB = function (active) {
      return {
        font: '500 11px/1 ui-monospace, monospace', letterSpacing: '0.05em',
        padding: '6px 10px', cursor: 'pointer', borderRadius: 4,
        border: '1px solid ' + (active ? '#c2410c' : 'var(--rule, #555)'),
        background: active ? '#c2410c' : 'transparent',
        color: active ? '#fff' : 'var(--ink-soft, #a09888)',
      };
    };
    var RESULT = {
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
      padding: '8px 10px', border: '1px solid var(--rule, #444)', borderRadius: 4,
      background: 'transparent', color: 'inherit', marginBottom: 4, font: '13px sans-serif',
    };

    // work 편집기: ① 기존 곡 검색(재연결) ② MusicBrainz ③ 직접 입력
    function WorkEditor(props) {
      var work = props.work || {};
      var so = useState(false), open = so[0], setOpen = so[1];
      var sm = useState('existing'), mode = sm[0], setMode = sm[1];
      var sq = useState(''), q = sq[0], setQ = sq[1];
      var smb = useState([]), mbRes = smb[0], setMbRes = smb[1];
      var sl = useState(false), loading = sl[0], setLoading = sl[1];
      var stx = useState(work.mb_title || work.title_variant || ''), text = stx[0], setText = stx[1];
      if (!KovoxAdmin.enabled) return null;

      if (!open) {
        return h('button', { style: plain({ margin: '4px 0 12px 24px' }), onClick: function () { setOpen(true); } }, '✎ work 수정');
      }

      // ① 기존 곡 매칭 (전체 검색 → 현재 composer 우선 정렬 → 스크롤 표시)
      var works = (window.KOVOX_RDB && window.KOVOX_RDB.works) || [];
      var matches = [];
      var matchTotal = 0;
      if (mode === 'existing' && q.trim()) {
        var ql = q.trim().toLowerCase();
        for (var i = 0; i < works.length; i++) {
          var w = works[i];
          if (w.work_id === work.work_id) continue;
          var t = (w.mb_title || w.title_variant || '').toLowerCase();
          var c = (w.mb_composer || '').toLowerCase();
          if (t.indexOf(ql) !== -1 || c.indexOf(ql) !== -1) matches.push(w);
        }
        matchTotal = matches.length;
        matches = rankByComposer(matches, work.mb_composer, function (m) { return m.mb_composer; }).slice(0, MAX_RESULTS);
      }

      function relink(w2) {
        if (!work._programItemId) { alert('이 곡은 program 항목 정보가 없어 재연결할 수 없습니다. MusicBrainz / 직접 입력을 사용하세요.'); return; }
        KovoxAdmin.applyAndReload([{ store: 'rdb', collection: 'programs', key: 'program_item_id', match: work._programItemId, set: { work_id: w2.work_id } }]);
      }
      function enrichFromMB(r) {
        var set = { mb_title: r.title, mbid: r.id };
        var comp = mbComposer(r);
        if (comp) set.mb_composer = comp;
        if (r.language) set.mb_language = r.language;
        KovoxAdmin.applyAndReload([{ store: 'rdb', collection: 'works', key: 'work_id', match: work.work_id, set: set }]);
      }
      function rename() {
        if (!text.trim()) return;
        KovoxAdmin.applyAndReload([{ store: 'rdb', collection: 'works', key: 'work_id', match: work.work_id, set: { mb_title: text.trim() } }]);
      }
      function runMB() {
        if (q.trim().length < 2) return;
        setLoading(true);
        searchMB(q.trim()).then(function (rs) { setMbRes(rs); setLoading(false); })
          .catch(function () { setMbRes([]); setLoading(false); });
      }

      var tabs = h('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
        h('button', { style: TAB(mode === 'existing'), onClick: function () { setMode('existing'); } }, '기존 곡 검색'),
        h('button', { style: TAB(mode === 'mb'), onClick: function () { setMode('mb'); } }, 'MusicBrainz'),
        h('button', { style: TAB(mode === 'text'), onClick: function () { setMode('text'); } }, '직접 입력')
      );

      var curC = (work.mb_composer || '').trim();
      function sameComposer(name) { return curC && composerRank(curC, name) === 0; }
      var body;
      if (mode === 'existing') {
        body = h('div', null,
          h('input', {
            value: q, autoFocus: true, placeholder: 'SEARCH EXISTING WORKS / 기존 곡·작곡가 검색...',
            style: { width: '100%', maxWidth: 460, font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 8 },
            onChange: function (e) { setQ(e.target.value); },
          }),
          curC ? h('div', { style: { marginBottom: 6, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '현재 작곡가 "' + curC + '" 와 일치하는 곡을 상단에 표시합니다') : null,
          h('div', { style: SCROLLBOX }, matches.map(function (m) {
            var hit = sameComposer(m.mb_composer);
            var st = {}; for (var k in RESULT) st[k] = RESULT[k];
            if (hit) { st.borderColor = '#c2410c'; st.background = 'rgba(194,65,11,0.06)'; }
            return h('button', { key: m.work_id, style: st, onClick: function () { relink(m); } },
              hit ? h('span', { style: { color: '#c2410c', marginRight: 6, fontSize: 11 } }, '●') : null,
              h('span', { style: { fontWeight: 500 } }, m.mb_title || m.title_variant),
              h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, m.mb_composer || ''),
              h('span', { style: { color: '#c2410c', marginLeft: 8, fontSize: 10, fontFamily: 'ui-monospace, monospace' } }, KovoxAdmin.workUsage(m.work_id) + '회'));
          })),
          q.trim() && matchTotal === 0 ? h('div', { style: { font: '12px ui-monospace, monospace', color: 'var(--ink-soft, #a09888)' } }, '일치하는 기존 곡 없음') : null,
          matchTotal > 0 ? h('div', { style: { marginTop: 4, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '총 ' + matchTotal + '곡' + (matchTotal > MAX_RESULTS ? ' (상위 ' + MAX_RESULTS + '곡 표시 — 검색어를 더 좁혀보세요)' : '') + ' · 스크롤하여 전체 확인') : null,
          h('div', { style: { marginTop: 4, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '선택하면 이 곡이 기존 work 에 연결됩니다 (엔티티 병합).')
        );
      } else if (mode === 'mb') {
        var mbSorted = rankByComposer(mbRes, curC, function (r) { return mbComposer(r); });
        body = h('div', null,
          h('div', { style: { display: 'flex', gap: 6, maxWidth: 460, marginBottom: 8 } },
            h('input', {
              value: q, placeholder: 'MusicBrainz 에서 곡 검색...',
              style: { flex: 1, font: '14px sans-serif', padding: 8, boxSizing: 'border-box' },
              onChange: function (e) { setQ(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') runMB(); },
            }),
            h('button', { style: primary(), onClick: runMB }, loading ? '검색중…' : '검색')
          ),
          curC ? h('div', { style: { marginBottom: 6, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '현재 작곡가 "' + curC + '" 와 일치하는 결과를 상단에 표시합니다') : null,
          h('div', { style: SCROLLBOX }, mbSorted.map(function (r) {
            var hit = sameComposer(mbComposer(r));
            var st = {}; for (var k in RESULT) st[k] = RESULT[k];
            if (hit) { st.borderColor = '#c2410c'; st.background = 'rgba(194,65,11,0.06)'; }
            return h('button', { key: r.id, style: st, onClick: function () { enrichFromMB(r); } },
              hit ? h('span', { style: { color: '#c2410c', marginRight: 6, fontSize: 11 } }, '●') : null,
              h('span', { style: { fontWeight: 500 } }, r.title),
              h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, mbComposer(r)),
              r.language ? h('span', { style: { color: '#6bc5f5', marginLeft: 8, fontSize: 10 } }, r.language) : null);
          })),
          h('div', { style: { marginTop: 4, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '선택하면 현재 work 의 제목·작곡가·MBID 가 채워집니다.')
        );
      } else {
        body = h('div', null,
          h('input', {
            value: text, autoFocus: true, placeholder: '곡 제목 직접 입력',
            style: { width: '100%', maxWidth: 460, font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 8 },
            onChange: function (e) { setText(e.target.value); },
            onKeyDown: function (e) { if (e.key === 'Enter') rename(); },
          }),
          h('div', null, h('button', { style: primary(), onClick: rename }, '저장'))
        );
      }

      return h('div', { style: { margin: '6px 0 16px 24px', padding: 12, border: '1px solid var(--rule, #444)', borderRadius: 6, maxWidth: 500 } },
        tabs, body,
        h('div', { style: { marginTop: 10 } },
          h('button', { style: plain(), onClick: function () { setOpen(false); } }, '닫기'))
      );
    }

    // work 선택기 (곡 추가용): ① 기존 곡 ② MusicBrainz ③ 직접 입력
    //   onPick({ kind:'existing', work }) 또는 onPick({ kind:'new', title, composer, language, mbid })
    function WorkPicker(props) {
      var sm = useState('existing'), mode = sm[0], setMode = sm[1];
      var sq = useState(''), q = sq[0], setQ = sq[1];
      var smb = useState([]), mbRes = smb[0], setMbRes = smb[1];
      var sl = useState(false), loading = sl[0], setLoading = sl[1];
      var sc = useState({ title: '', composer: '', language: '' }), cw = sc[0], setCw = sc[1];
      if (!KovoxAdmin.enabled) return null;

      var works = (window.KOVOX_RDB && window.KOVOX_RDB.works) || [];
      var matches = [];
      var matchTotal = 0;
      if (mode === 'existing' && q.trim()) {
        var ql = q.trim().toLowerCase();
        for (var i = 0; i < works.length; i++) {
          var w = works[i];
          var t = (w.mb_title || w.title_variant || '').toLowerCase();
          var c = (w.mb_composer || '').toLowerCase();
          if (t.indexOf(ql) !== -1 || c.indexOf(ql) !== -1) matches.push(w);
        }
        matchTotal = matches.length;
        if (props.composerHint) matches = rankByComposer(matches, props.composerHint, function (m) { return m.mb_composer; });
        matches = matches.slice(0, MAX_RESULTS);
      }
      function runMB() {
        if (q.trim().length < 2) return;
        setLoading(true);
        searchMB(q.trim()).then(function (rs) { setMbRes(rs); setLoading(false); })
          .catch(function () { setMbRes([]); setLoading(false); });
      }

      var tabs = h('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
        h('button', { style: TAB(mode === 'existing'), onClick: function () { setMode('existing'); } }, '기존 곡 검색'),
        h('button', { style: TAB(mode === 'mb'), onClick: function () { setMode('mb'); } }, 'MusicBrainz'),
        h('button', { style: TAB(mode === 'custom'), onClick: function () { setMode('custom'); } }, '직접 입력')
      );

      var body;
      if (mode === 'existing') {
        body = h('div', null,
          h('input', {
            value: q, autoFocus: true, placeholder: 'SEARCH EXISTING WORKS / 기존 곡·작곡가 검색...',
            style: { width: '100%', maxWidth: 460, font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 8 },
            onChange: function (e) { setQ(e.target.value); },
          }),
          h('div', { style: SCROLLBOX }, matches.map(function (m) {
            return h('button', { key: m.work_id, style: RESULT, onClick: function () { props.onPick({ kind: 'existing', work: m }); } },
              h('span', { style: { fontWeight: 500 } }, m.mb_title || m.title_variant),
              h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, m.mb_composer || ''),
              h('span', { style: { color: '#c2410c', marginLeft: 8, fontSize: 10, fontFamily: 'ui-monospace, monospace' } }, KovoxAdmin.workUsage(m.work_id) + '회'));
          })),
          matchTotal > 0 ? h('div', { style: { marginTop: 4, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '총 ' + matchTotal + '곡' + (matchTotal > MAX_RESULTS ? ' (상위 ' + MAX_RESULTS + '곡 표시 — 검색어를 더 좁혀보세요)' : '') + ' · 스크롤하여 전체 확인') : null
        );
      } else if (mode === 'mb') {
        body = h('div', null,
          h('div', { style: { display: 'flex', gap: 6, maxWidth: 460, marginBottom: 8 } },
            h('input', {
              value: q, placeholder: 'MusicBrainz 에서 곡 검색...',
              style: { flex: 1, font: '14px sans-serif', padding: 8, boxSizing: 'border-box' },
              onChange: function (e) { setQ(e.target.value); },
              onKeyDown: function (e) { if (e.key === 'Enter') runMB(); },
            }),
            h('button', { style: primary(), onClick: runMB }, loading ? '검색중…' : '검색')
          ),
          h('div', { style: { maxWidth: 460 } }, mbRes.map(function (r) {
            return h('button', { key: r.id, style: RESULT, onClick: function () { props.onPick({ kind: 'new', title: r.title, composer: mbComposer(r), language: r.language || '', mbid: r.id }); } },
              h('span', { style: { fontWeight: 500 } }, r.title),
              h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, mbComposer(r)));
          }))
        );
      } else {
        var fld = function (label, key, ph) {
          return h('div', { style: { marginBottom: 8 } },
            h('label', { style: { font: '10px ui-monospace, monospace', color: 'var(--ink-soft, #a09888)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 } }, label),
            h('input', {
              value: cw[key], placeholder: ph,
              style: { width: '100%', maxWidth: 460, font: '14px sans-serif', padding: 8, boxSizing: 'border-box' },
              onChange: function (e) { var v = e.target.value; setCw(function (p) { var n = {}; for (var k in p) n[k] = p[k]; n[key] = v; return n; }); },
            }));
        };
        body = h('div', null,
          fld('곡 제목', 'title', '예: Das Veilchen'),
          fld('작곡가', 'composer', '예: Wolfgang Amadeus Mozart (기존 이름과 일치 시 연결)'),
          fld('언어 코드', 'language', '예: deu / ita / kor (선택)'),
          h('button', { style: primary(), onClick: function () { if (cw.title.trim()) props.onPick({ kind: 'new', title: cw.title.trim(), composer: cw.composer.trim(), language: cw.language.trim(), mbid: null }); } }, '추가')
        );
      }

      return h('div', { style: { margin: '6px 0', padding: 12, border: '1px solid var(--rule, #444)', borderRadius: 6, maxWidth: 500, background: 'rgba(255,255,255,0.02)' } },
        tabs, body,
        h('div', { style: { marginTop: 10 } }, h('button', { style: plain(), onClick: props.onCancel }, '취소'))
      );
    }

    // Host / Sponsor 엔티티(그룹) 추가·삭제기
    //   props: role('Host'|'Sponsor'), fullPerfId('PERF_xxx'), perfRdbId(or null),
    //          groups([{group_id,group_name}]), legacy(string), legacyField
    function GroupEditor(props) {
      var sa = useState(false), adding = sa[0], setAdding = sa[1];
      var sq = useState(''), q = sq[0], setQ = sq[1];
      var se = useState(false), editLegacy = se[0], setEditLegacy = se[1];
      var sl = useState(props.legacy || ''), legacyVal = sl[0], setLegacyVal = sl[1];
      if (!KovoxAdmin.enabled) return null;

      var roleKr = props.role === 'Host' ? '주최' : '후원';
      var current = props.groups || [];
      var currentIds = {};
      current.forEach(function (g) { currentIds[g.group_id] = 1; });

      var allGroups = (window.KOVOX_RDB && window.KOVOX_RDB.groups) || [];
      var suggestions = [];
      if (q.trim()) {
        var ql = q.trim().toLowerCase();
        for (var i = 0; i < allGroups.length && suggestions.length < 10; i++) {
          var gg = allGroups[i];
          if (currentIds[gg.group_id]) continue;
          if ((gg.group_name || '').toLowerCase().indexOf(ql) !== -1) suggestions.push(gg);
        }
      }

      function removeGroup(g) {
        if (!window.confirm(g.group_name + ' 을(를) 이 공연의 ' + roleKr + '에서 제거할까요?\n(그룹 자체는 삭제되지 않고 연결만 끊습니다)')) return;
        KovoxAdmin.applyAndReload([{
          store: 'rdb', collection: 'perfGroups', op: 'delete',
          where: { performance_id: props.fullPerfId, group_id: g.group_id, role: props.role },
        }]);
      }
      function addExisting(g) {
        KovoxAdmin.applyAndReload([{
          store: 'rdb', collection: 'perfGroups', op: 'insert',
          rows: { performance_id: props.fullPerfId, group_id: g.group_id, role: props.role },
        }]);
      }
      function addNew(name) {
        var gid = KovoxAdmin.newId('GROUP_USER_');
        KovoxAdmin.applyAndReload([
          { store: 'rdb', collection: 'groups', op: 'insert', rows: { group_id: gid, group_name: name } },
          { store: 'rdb', collection: 'perfGroups', op: 'insert', rows: { performance_id: props.fullPerfId, group_id: gid, role: props.role } },
        ]);
      }
      function saveLegacy() {
        if (!props.perfRdbId) { alert('이 공연은 RDB 레코드가 없어 텍스트 필드를 수정할 수 없습니다. 그룹으로 추가하세요.'); return; }
        KovoxAdmin.applyAndReload([{
          store: 'rdb', collection: 'performances', key: 'performance_id', match: props.perfRdbId,
          set: (function () { var s = {}; s[props.legacyField] = legacyVal.trim() || null; return s; })(),
        }]);
      }

      var chips = current.map(function (g) {
        return h('span', { key: g.group_id, style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', marginRight: 6, marginBottom: 6, border: '1px solid var(--rule, #555)', borderRadius: 12, fontSize: 12 } },
          g.group_name,
          h('button', { title: '제거', style: { background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }, onClick: function () { removeGroup(g); } }, '✕'));
      });

      var addUI = !adding
        ? h('button', { style: plain({ borderStyle: 'dashed' }), onClick: function () { setAdding(true); } }, '+ ' + roleKr + ' 추가')
        : h('div', { style: { margin: '6px 0', padding: 10, border: '1px solid var(--rule, #444)', borderRadius: 6, maxWidth: 420 } },
            h('input', {
              value: q, autoFocus: true, placeholder: '기존 ' + roleKr + ' 검색 또는 새 이름 입력...',
              style: { width: '100%', font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 6 },
              onChange: function (e) { setQ(e.target.value); },
            }),
            suggestions.length ? h('div', { style: { marginBottom: 6 } }, suggestions.map(function (g) {
              return h('button', { key: g.group_id, style: RESULT, onClick: function () { addExisting(g); } }, g.group_name);
            })) : null,
            h('div', { style: { display: 'flex', gap: 8 } },
              h('button', { style: primary(), onClick: function () { if (q.trim()) addNew(q.trim()); } }, '＋ 새 ' + roleKr + '로 추가'),
              h('button', { style: plain(), onClick: function () { setAdding(false); setQ(''); } }, '취소')),
            q.trim() ? h('div', { style: { marginTop: 5, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '목록에서 고르면 기존 그룹에 연결, 버튼을 누르면 새 그룹 생성') : null
          );

      var legacyUI = null;
      if (props.legacy) {
        legacyUI = !editLegacy
          ? h('div', { style: { marginTop: 6 } }, h('span', { style: { font: '11px ui-monospace, monospace', color: '#8a8478' } }, '기존 텍스트: ' + props.legacy + ' '),
              h('button', { style: plain(), onClick: function () { setLegacyVal(props.legacy || ''); setEditLegacy(true); } }, '✎ 텍스트 수정'))
          : h('div', { style: { marginTop: 6, maxWidth: 420 } },
              h('input', { value: legacyVal, style: { width: '100%', font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 6 }, onChange: function (e) { setLegacyVal(e.target.value); } }),
              h('div', { style: { display: 'flex', gap: 8 } },
                h('button', { style: primary(), onClick: saveLegacy }, '저장'),
                h('button', { style: plain(), onClick: function () { setEditLegacy(false); } }, '취소')));
      }

      return h('div', { style: { marginTop: 10 } },
        chips.length ? h('div', { style: { marginBottom: 6 } }, chips) : null,
        addUI,
        legacyUI
      );
    }

    // 공연에 performer(singer/accompanist) 추가
    //   props: role('main performer'|'accompanist'), fullPerfId('PERF_xxx')
    function PerformerAdder(props) {
      var so = useState(false), open = so[0], setOpen = so[1];
      var sq = useState(''), q = sq[0], setQ = sq[1];
      var sm = useState(''), med = sm[0], setMed = sm[1];
      if (!KovoxAdmin.enabled) return null;
      var roleLabel = props.role === 'accompanist' ? 'ACCOMPANIST' : 'SINGER';

      if (!open) {
        return h('button', { style: plain({ borderStyle: 'dashed', marginTop: 10 }), onClick: function () { setOpen(true); } }, '+ ' + roleLabel + ' 추가');
      }

      var persons = (window.KOVOX_RDB && window.KOVOX_RDB.persons) || [];
      var matches = [];
      if (q.trim()) {
        var ql = q.trim().toLowerCase();
        for (var i = 0; i < persons.length && matches.length < 10; i++) {
          if ((persons[i].person_name || '').toLowerCase().indexOf(ql) !== -1) matches.push(persons[i]);
        }
      }
      function partRow(personId) {
        return { performance_id: props.fullPerfId, program_item_id: props.fullPerfId + '_PART_' + KovoxAdmin.newId(''), person_id: personId };
      }
      function addExisting(person) {
        var parts = (window.KOVOX_RDB && window.KOVOX_RDB.participations) || [];
        if (parts.some(function (pa) { return pa.performance_id === props.fullPerfId && pa.person_id === person.person_id; })) {
          alert(person.person_name + ' 은(는) 이미 이 공연에 등록되어 있습니다.'); return;
        }
        var edits = [{ store: 'rdb', collection: 'participations', op: 'insert', rows: partRow(person.person_id) }];
        if (person.person_role !== props.role) {
          if (!window.confirm(person.person_name + ' 의 현재 역할은 "' + person.person_role + '" 입니다.\n' + roleLabel + '로 추가하려면 역할을 "' + props.role + '"(으)로 변경합니다. 계속할까요?\n(이 사람의 모든 공연에 함께 반영됩니다)')) return;
          edits.push({ store: 'rdb', collection: 'persons', key: 'person_id', match: person.person_id, set: { person_role: props.role } });
        }
        KovoxAdmin.applyAndReload(edits);
      }
      function addNew() {
        if (!q.trim()) return;
        var pid = KovoxAdmin.newId('PERSON_USER_');
        KovoxAdmin.applyAndReload([
          { store: 'rdb', collection: 'persons', op: 'insert', rows: { person_id: pid, person_name: q.trim(), person_role: props.role, person_medium: med.trim() || null, person_profile: null, person_isni: null } },
          { store: 'rdb', collection: 'participations', op: 'insert', rows: partRow(pid) },
        ]);
      }

      return h('div', { style: { marginTop: 10, padding: 12, border: '1px solid var(--rule, #444)', borderRadius: 6, maxWidth: 460 } },
        h('input', {
          value: q, autoFocus: true, placeholder: '이름 검색 또는 새 이름 입력...',
          style: { width: '100%', font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 6 },
          onChange: function (e) { setQ(e.target.value); },
        }),
        matches.length ? h('div', { style: { marginBottom: 8 } }, matches.map(function (p) {
          return h('button', { key: p.person_id, style: RESULT, onClick: function () { addExisting(p); } },
            h('span', { style: { fontWeight: 500 } }, p.person_name),
            h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, (p.person_role || '') + (p.person_medium ? ' · ' + p.person_medium : '')));
        })) : null,
        h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 } },
          h('input', { value: med, placeholder: roleLabel === 'SINGER' ? '성종 예: soprano' : '악기 예: piano', style: { width: 170, font: '13px sans-serif', padding: 8 }, onChange: function (e) { setMed(e.target.value); } }),
          h('button', { style: primary(), onClick: addNew }, '＋ 새 인물로 추가')),
        h('div', { style: { marginTop: 8 } }, h('button', { style: plain(), onClick: function () { setOpen(false); setQ(''); setMed(''); } }, '취소')),
        q.trim() ? h('div', { style: { marginTop: 5, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '목록에서 고르면 기존 인물 연결, 오른쪽 버튼은 새 인물 생성') : null
      );
    }

    // 인물(반주자/성악가) 이 공연에서 제거 · 동명이인 통합
    //   props: person, fullPerfId('PERF_xxx'), roleLabel('ACCOMPANIST'|'SINGER')
    function PerformerControls(props) {
      var sm = useState(''), mode = sm[0], setMode = sm[1]; // '' | 'merge'
      var sq = useState(''), q = sq[0], setQ = sq[1];
      if (!KovoxAdmin.enabled) return null;
      var person = props.person;
      if (!person) return null;
      var roleKr = props.roleLabel === 'SINGER' ? '성악가' : '반주자';

      function perfCount(pid) {
        var parts = (window.KOVOX_RDB && window.KOVOX_RDB.participations) || [];
        var s = {};
        parts.forEach(function (pa) { if (pa.person_id === pid) s[pa.performance_id] = 1; });
        return Object.keys(s).length;
      }
      function removeHere() {
        if (!window.confirm(person.person_name + ' 을(를) 이 공연의 ' + roleKr + '에서 제거할까요?\n(인물 자체는 남고, 이 공연과의 연결만 끊습니다)')) return;
        KovoxAdmin.applyAndReload([{ store: 'rdb', collection: 'participations', op: 'delete', where: { performance_id: props.fullPerfId, person_id: person.person_id } }]);
      }
      function mergeInto(dup) {
        if (!window.confirm('"' + dup.person_name + '" (' + dup.person_id + ') 을(를)\n"' + person.person_name + '" (' + person.person_id + ') (으)로 통합할까요?\n\n통합 대상의 모든 공연 참여가 이 인물로 합쳐지고, 통합 대상 레코드는 삭제됩니다.\n되돌릴 수 없습니다 (.bak 백업 생성).')) return;
        KovoxAdmin.applyAndReload([{ store: 'rdb', collection: 'participations', op: 'mergePerson', fromId: dup.person_id, toId: person.person_id }]);
      }

      var persons = (window.KOVOX_RDB && window.KOVOX_RDB.persons) || [];
      var norm = function (s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); };
      var meName = norm(person.person_name);
      var cands = [];
      if (mode === 'merge') {
        var ql = norm(q);
        for (var i = 0; i < persons.length && cands.length < 50; i++) {
          var p = persons[i];
          if (p.person_id === person.person_id) continue;
          var sameName = norm(p.person_name) === meName;
          if (ql ? norm(p.person_name).indexOf(ql) !== -1 : sameName) cands.push(p);
        }
      }

      var bar = h('div', { style: { marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' } },
        h('button', { style: plain({ color: '#b91c1c', borderColor: '#b91c1c' }), onClick: removeHere }, '✕ 이 공연에서 제거'),
        h('button', { style: plain(), onClick: function () { setMode(mode === 'merge' ? '' : 'merge'); setQ(''); } }, mode === 'merge' ? '통합 닫기' : '⇆ 동명이인 통합…')
      );

      var panel = mode === 'merge' ? h('div', { style: { marginTop: 6, padding: 10, border: '1px solid var(--rule, #444)', borderRadius: 6, maxWidth: 460 } },
        h('div', { style: { font: '11px ui-monospace, monospace', color: '#8a8478', marginBottom: 6 } }, '유지할 인물: ' + person.person_name + ' (' + person.person_id + ') · ' + perfCount(person.person_id) + '회'),
        h('input', { value: q, autoFocus: true, placeholder: '같은 이름 자동 표시 — 다르게 적힌 이름이면 검색...', style: { width: '100%', font: '14px sans-serif', padding: 8, boxSizing: 'border-box', marginBottom: 6 }, onChange: function (e) { setQ(e.target.value); } }),
        h('div', { style: SCROLLBOX }, cands.map(function (c) {
          return h('button', { key: c.person_id, style: RESULT, onClick: function () { mergeInto(c); } },
            h('span', { style: { fontWeight: 500 } }, c.person_name),
            h('span', { style: { color: 'var(--ink-soft, #a09888)', marginLeft: 8, fontSize: 11 } }, (c.person_role || '') + (c.person_medium ? ' · ' + c.person_medium : '') + ' · ' + c.person_id),
            h('span', { style: { color: '#c2410c', marginLeft: 8, fontSize: 10, fontFamily: 'ui-monospace, monospace' } }, perfCount(c.person_id) + '회'));
        })),
        cands.length === 0 ? h('div', { style: { font: '11px ui-monospace, monospace', color: '#8a8478' } }, q ? '검색 결과 없음' : '같은 이름의 다른 인물이 없습니다 — 다르게 적힌 경우 검색하세요') : null,
        h('div', { style: { marginTop: 6, font: '11px ui-monospace, monospace', color: '#8a8478' } }, '고른 인물이 위 "유지할 인물"로 합쳐집니다 (중복 참여는 자동 정리).')
      ) : null;

      return h('div', null, bar, panel);
    }

    KovoxAdmin.Editable = Editable;
    KovoxAdmin.ComposerPicker = ComposerPicker;
    KovoxAdmin.PerformerControls = PerformerControls;
    KovoxAdmin.WorkEditor = WorkEditor;
    KovoxAdmin.WorkPicker = WorkPicker;
    KovoxAdmin.GroupEditor = GroupEditor;
    KovoxAdmin.PerformerAdder = PerformerAdder;
    KovoxAdmin.newId = function (prefix) { return prefix + Date.now() + '_' + Math.floor(Math.random() * 100000); };
  }

  defineWidgets();
  window.KovoxAdmin = KovoxAdmin;
})();
