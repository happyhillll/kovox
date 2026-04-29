/* global React, KOVOX_DATA */
const { useState: useS } = React;
const D = window.KOVOX_DATA;

const NAV_LINKS = [
  { label: 'Performances', href: '#/performances' },
  { label: 'Singers', href: '#/singers' },
  { label: 'Works', href: '#/repertoire' },
  { label: 'Network', href: '#/network' },
  { label: 'Archive', href: '#/archive' },
  { label: 'About', href: '#/about' }
];

const Nav2 = ({ active = '' }) => (
  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px', borderBottom: '1px solid var(--rule)' }}>
    <a href="#/" className="display" style={{ fontSize: 20, textDecoration: 'none', color: 'var(--ink)' }}>KO<span className="coral">VOX</span></a>
    <nav style={{ display: 'flex', gap: 32, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {NAV_LINKS.map(x => (
        <a key={x.label} href={x.href} style={{ color: active === x.label ? 'var(--coral)' : 'var(--ink-soft)', textDecoration: 'none' }}>{x.label}</a>
      ))}
    </nav>
    <a href="#/search" className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', cursor: 'pointer' }}>⌕ SEARCH</a>
  </header>
);

const PageHeader = ({ kicker, title, count, sub }) => (
  <section style={{ padding: '60px 56px 40px' }}>
    <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● {kicker}</div>
    <h1 className="display" style={{ fontSize: 128, lineHeight: 0.9, margin: 0, letterSpacing: '-0.03em' }}>{title} {count && <span className="coral">{count}</span>}</h1>
    {sub && <p style={{ fontSize: 18, color: 'var(--ink-soft)', maxWidth: 720, marginTop: 24 }}>{sub}</p>}
  </section>
);

/* ================= EMBEDDED TIME VIEW (live viewer) ================= */
function VikusTimeView() {
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 8 }}>● LIVE EMBED · VIKUS VIEWER</div>
          <div className="display" style={{ fontSize: 28 }}>2016 — 2025 · CHRONOLOGICAL <span className="coral">SCATTER</span></div>
        </div>
        <a href="viewer/" target="_blank" className="mono coral" style={{ fontSize: 11, letterSpacing: '0.15em', textDecoration: 'none' }}>OPEN IN NEW TAB ↗</a>
      </div>
      <div style={{ position: 'relative', border: '1px solid var(--coral)', background: '#000', height: 720, overflow: 'hidden' }}>
        <iframe src="viewer/" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="KoVox Timeline (live)" />
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--ink-soft)' }} className="mono">위 영역은 실제 VIKUS Viewer가 임베드된 라이브 뷰입니다 · 작곡가 호버, 시간축 스크롤 등 모든 인터랙션 작동</div>
    </div>
  );
}

/* ================= ARCHIVE ================= */
function Archive() {
  return (
    <div className="kv2" style={{ width: '100%', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav2 active="Archive" />
      <PageHeader kicker={'THE ARCHIVE / 2016 — 2025'} title="ARCHIVE" count={String(D.stats.totalRecitals)} sub="한국에서 열린 모든 클래식 음악 독창회. 연도, 작곡가, 곡 제목, 성악가 이름으로 탐색하세요." />
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe src="viewer/" style={{ width: '100%', height: 'calc(100vh - 260px)', minHeight: 600, border: 'none', display: 'block' }} title="KoVox Timeline (live)" />
      </div>
    </div>
  );
}

/* ================= COMPOSERS ================= */
function Composers() {
  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Composers" />
      <PageHeader kicker="INDEX I" title="COMPOSERS" count={String(D.stats.totalComposers)} sub="17세기 카치니에서 동시대 윤학준까지 — 한국 독창회 무대에 오른 모든 작곡가." />
      <section style={{ padding: '0 56px 80px' }}>
        {D.composers.map((c, i) => (
          <a key={c.name} href={'#/composer/' + encodeURIComponent(c.name)} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 60px', gap: 24, padding: '24px 0', borderTop: '1px solid var(--rule)', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>№ {String(i + 1).padStart(3, '0')}</span>
            <span className="display coral" style={{ fontSize: 36, letterSpacing: '-0.02em' }}>{c.name.toUpperCase()}</span>
            <span className="display" style={{ fontSize: 28, textAlign: 'right' }}>{c.count}</span>
            <span className="coral" style={{ fontSize: 22, textAlign: 'right' }}>→</span>
          </a>
        ))}
      </section>
    </div>
  );
}

/* ================= SINGERS ================= */
function Singers() {
  // Get unique singers with their most recent performance
  const singerMap = {};
  D.performances.forEach(p => {
    if (p.singer && p.singer !== '—' && !singerMap[p.singer]) {
      singerMap[p.singer] = p;
    }
  });
  const singers = Object.values(singerMap).slice(0, 40);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Singers" />
      <PageHeader kicker="INDEX II" title="SINGERS" count={String(D.stats.totalSingers)} />
      <section style={{ padding: '0 56px 60px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {singers.map(s => (
          <article key={s.id}>
            <div className="placeholder" style={{ height: 260, width: '100%' }}>portrait</div>
            <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.15em', marginTop: 16 }}>{s.voice.toUpperCase()}</div>
            <div className="display-kr" style={{ fontSize: 32, marginTop: 4 }}>{s.singer}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>{s.date} · {s.venue}</div>
          </article>
        ))}
      </section>
    </div>
  );
}

/* ================= CALENDAR ================= */
function Calendar() {
  // Group performances by year-month
  const byMonth = {};
  D.performances.forEach(p => {
    const ym = p.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(p);
  });
  const months = Object.keys(byMonth).sort().reverse().slice(0, 12);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Calendar" />
      <PageHeader kicker="CHRONOLOGY" title="CALENDAR" sub="연도별 · 월별 독창회 기록." />
      <section style={{ padding: '0 56px 80px' }}>
        {months.map(ym => (
          <div key={ym} style={{ marginBottom: 48 }}>
            <div className="display coral" style={{ fontSize: 36, marginBottom: 16, borderBottom: '2px solid var(--rule)', paddingBottom: 12 }}>{ym}</div>
            {byMonth[ym].map(p => (
              <a key={p.id} href={'#/detail/' + p.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 200px 100px 40px', gap: 24, padding: '16px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
                <span className="display coral" style={{ fontSize: 28 }}>{p.date.split('.')[2]}</span>
                <span className="display-kr" style={{ fontSize: 20 }}>{p.title}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.venue}</span>
                <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em' }}>{p.voice.toUpperCase()}</span>
                <span className="coral" style={{ fontSize: 18, textAlign: 'right' }}>→</span>
              </a>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/* ================= DETAIL ================= */
function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^?&]+)/);
  return m ? m[1] : null;
}

function Detail({ perfId }) {
  const p = D.performances.find(x => String(x.id) === String(perfId)) || D.performances[0];
  const rdb = window.KOVOX_RDB ? window.KOVOX_RDB.performances.find(x => x.performance_id === 'PERF_' + perfId) : null;
  const startTime = (rdb && rdb.start_time) || p.time || '—';
  const duration = (rdb && rdb.duration_minutes) ? rdb.duration_minutes + 'min' : '—';
  const host = (rdb && rdb.host_organization) || null;
  const sponsor = (rdb && rdb.sponsoring_organization) || null;
  const youtubeUrl = (rdb && rdb._youtube) || null;
  const youtubeId = getYoutubeId(youtubeUrl);
  const brochures = (rdb && rdb._brochures) || [];

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 />
      <div style={{ padding: '20px 56px', borderBottom: '1px solid var(--rule)' }}>
        <a href="#/performances" className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.15em', textDecoration: 'none' }}>← PERFORMANCES / </a>
        <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.15em' }}>№ {p.id}</span>
      </div>
      <section style={{ padding: '40px 56px', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 64 }}>
        <div style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
          <img src={(rdb && rdb._poster) || ('viewer/data/4096/' + p.id + '.jpg')} alt={p.title} style={{ width: '100%', height: 'auto', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.minHeight = '620px'; e.target.parentElement.classList.add('placeholder'); e.target.parentElement.setAttribute('data-label', 'poster'); }} />
        </div>
        <div>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em' }}>● {p.voice.toUpperCase()} · {p.date}</div>
          <h1 className="display-kr" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.04em', margin: '20px 0 0' }}>
            {p.title}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
            {[['DATE', p.date], ['START', startTime], ['DURATION', duration], ['VENUE', p.venue]].map(([k, v]) => (
              <div key={k}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>{k}</div>
                <div className="display" style={{ fontSize: 20, marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </div>
          {(host || sponsor) && (
            <div style={{ display: 'grid', gridTemplateColumns: host && sponsor ? '1fr 1fr' : '1fr', gap: 16, marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--rule)' }}>
              {host && (
                <div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>HOST</div>
                  <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.4 }}>{host}</div>
                </div>
              )}
              {sponsor && (
                <div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>SPONSOR</div>
                  <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.4 }}>{sponsor}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      {youtubeId && (
        <section style={{ padding: '0 56px 40px' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● VIDEO</div>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000' }}>
            <iframe src={'https://www.youtube.com/embed/' + youtubeId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </section>
      )}
      {brochures.length > 0 && (
        <section style={{ padding: '0 56px 40px' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● BROCHURE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {brochures.map((src, i) => (
              <img key={i} src={src} alt={'Brochure ' + (i + 1)} style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--rule)' }} />
            ))}
          </div>
        </section>
      )}
      {window.KoVoxPagesRDB && window.KoVoxPagesRDB.DetailProgramme && React.createElement(window.KoVoxPagesRDB.DetailProgramme, { perfId: perfId })}
      <SimilarPrograms perfId={perfId} />
      {window.KoVoxPagesRDB && window.KoVoxPagesRDB.ReviewSection && React.createElement(window.KoVoxPagesRDB.ReviewSection, { perfId: perfId })}
    </div>
  );
}

/* ================= SIMILAR PROGRAMS (work-based) ================= */
function SimilarPrograms({ perfId }) {
  const similar = React.useMemo(() => {
    const RDB = window.KOVOX_RDB;
    if (!RDB) return [];

    const fullPerfId = 'PERF_' + perfId;
    // Get work IDs for this performance
    const myWorkIds = new Set();
    RDB.programs.forEach(pr => {
      if (pr.performance_id === fullPerfId && pr.work_id && pr.is_intermission !== 'TRUE') {
        myWorkIds.add(pr.work_id);
      }
    });
    if (myWorkIds.size === 0) return [];

    // Build work sets per performance
    const perfWorkSets = {};
    RDB.programs.forEach(pr => {
      if (!pr.work_id || pr.is_intermission === 'TRUE' || pr.performance_id === fullPerfId) return;
      if (!perfWorkSets[pr.performance_id]) perfWorkSets[pr.performance_id] = new Set();
      perfWorkSets[pr.performance_id].add(pr.work_id);
    });

    // Jaccard similarity based on works
    const results = [];
    Object.entries(perfWorkSets).forEach(([pid, workSet]) => {
      const shared = [...myWorkIds].filter(wid => workSet.has(wid));
      if (shared.length < 1) return;
      const union = new Set([...myWorkIds, ...workSet]);
      const perf = RDB.performances.find(p => p.performance_id === pid);
      if (!perf) return;

      // Get shared work titles
      const sharedTitles = shared.map(wid => {
        const w = RDB.works.find(x => x.work_id === wid);
        return w ? (w.mb_title || w.title_variant || '') : '';
      }).filter(Boolean);

      results.push({ perf, sharedCount: shared.length, score: shared.length / union.size, sharedTitles });
    });

    return results.sort((a, b) => b.score - a.score || b.sharedCount - a.sharedCount).slice(0, 10);
  }, [perfId]);

  if (similar.length === 0) return null;

  return (
    <section style={{ padding: '40px 56px 80px', borderTop: '1px solid var(--rule)' }}>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● SIMILAR PROGRAMMES</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 20 }}>같은 곡이 포함된 다른 독창회</div>
      {similar.map(({ perf: s, sharedCount, sharedTitles }) => {
        const idNum = s.performance_id.replace('PERF_', '');
        return (
          <a key={s.performance_id} href={'#/detail/' + idNum} style={{ display: 'block', padding: '18px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px 40px', gap: 24, alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{s.performance_date}</span>
              <span className="display-kr" style={{ fontSize: 20 }}>{s.performance_title}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{s.venue_name}</span>
              <span className="coral" style={{ fontSize: 18, textAlign: 'right' }}>→</span>
            </div>
            <div style={{ marginTop: 6, paddingLeft: 120 }}>
              <span className="mono coral" style={{ fontSize: 10, letterSpacing: '0.1em' }}>{sharedCount} shared: </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{sharedTitles.join(' · ')}</span>
            </div>
          </a>
        );
      })}
    </section>
  );
}

/* ================= CONTRIBUTE ================= */
function Contribute() {
  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Contribute" />
      <PageHeader kicker="CONTRIBUTE · 참여형 아카이브" title="ADD A RECITAL" sub="연주자, 기획자, 청중 — 누구든 공연 정보를 등록할 수 있습니다. 큐레이터 검토 후 24–48시간 내 게재됩니다." />
      <form style={{ padding: '0 56px 80px', maxWidth: 980 }}>
        {[
          ['TITLE / 공연 제목', 'text', 'full'],
          ['SINGER / 성악가', 'text'],
          ['VOICE TYPE / 성부', 'select'],
          ['DATE / 공연 일시', 'date'],
          ['TIME / 시작 시간', 'time'],
          ['VENUE / 장소', 'text'],
          ['CITY / 도시', 'text'],
          ['ACCOMPANIST / 반주자', 'text'],
          ['TICKET URL', 'text'],
          ['PROGRAMME / 프로그램', 'textarea', 'full'],
          ['POSTER / 포스터', 'file', 'full']
        ].map(([label, type, span]) => (
          <div key={label} style={{ display: span === 'full' ? 'block' : 'inline-block', width: span === 'full' ? '100%' : 'calc(50% - 12px)', marginRight: span !== 'full' ? 24 : 0, marginBottom: 28, verticalAlign: 'top' }}>
            <label className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', display: 'block', marginBottom: 12 }}>● {label}</label>
            {type === 'textarea' ? (
              <textarea rows="6" style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', padding: 16, fontFamily: 'inherit', fontSize: 15 }} />
            ) : type === 'select' ? (
              <select style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', padding: 16, fontFamily: 'inherit', fontSize: 15 }}>
                <option>소프라노</option><option>메조소프라노</option><option>테너</option><option>바리톤</option><option>베이스</option>
              </select>
            ) : (
              <input type={type} style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', padding: 16, fontFamily: 'inherit', fontSize: 15 }} />
            )}
          </div>
        ))}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <button type="button" className="kv2-btn-ghost">미리보기</button>
          <button type="button" className="kv2-btn">아카이브에 제출 →</button>
        </div>
      </form>
    </div>
  );
}

/* ================= EDITORIAL ================= */
function Editorial() {
  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Editorial" />
      <PageHeader kicker="EDITORIAL · 큐레이터 노트" title="NOTES" />
      {D.editorial.map((e, i) => (
        <article key={i} style={{ padding: '40px 56px 60px', borderTop: '1px solid var(--rule)' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.2em', marginBottom: 16 }}>● No. {String(i + 1).padStart(2, '0')} · {e.date} · {e.author.toUpperCase()}</div>
          <h2 className="display-kr" style={{ fontSize: 48, lineHeight: 1.1, margin: 0 }}>{e.title}</h2>
          <p style={{ fontSize: 20, color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 24, maxWidth: 800 }}>{e.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

/* ================= ABOUT ================= */
function About() {
  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="About" />

      {/* Hero */}
      <section style={{ padding: '120px 56px 60px', textAlign: 'center' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.3em', marginBottom: 32 }}>● COLOPHON · 2026</div>
        <h1 className="display-kr" style={{ fontSize: 96, lineHeight: 0.95, margin: 0, maxWidth: 1200, marginInline: 'auto', letterSpacing: '-0.04em' }}>
          국내 클래식 독창 공연의<br /><span className="coral">모든 것</span>
        </h1>
      </section>

      {/* Why */}
      <section style={{ padding: '60px 56px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.2em' }}>● WHY</div>
        <div style={{ fontSize: 20, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginTop: 0 }}>악보에는 작곡가의 의도가 담겨 있지만, 연주자의 숨결까지 담기지는 않습니다. 어떤 음색으로, 어떤 호흡으로 무대에 섰는지는 <strong style={{ color: 'var(--ink)' }}>공연 그 자체</strong>만이 알고 있습니다.</p>
          <p>하지만 공연은 한 번 끝나면 사라집니다. 남는 것은 포스터, 프로그램 노트, 브로슈어 — 이른바 <strong style={{ color: 'var(--ink)' }}>에페메라(ephemera)</strong>라 불리는 일회성 인쇄물뿐입니다. KoVox는 이 에페메라와 공연 기록을 한데 모아, 사라져가는 무대의 흔적을 보존합니다.</p>
        </div>
      </section>

      {/* Ephemera */}
      <section style={{ padding: '60px 56px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.2em' }}>● EPHEMERA</div>
        <div style={{ fontSize: 20, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginTop: 0 }}>에페메라는 원래 "하루만 지속되는 것"이라는 뜻의 그리스어에서 왔습니다. 공연 포스터, 티켓, 팸플릿처럼 <strong style={{ color: 'var(--ink)' }}>보존을 목적으로 만들어지지 않은 기록물</strong>을 말합니다.</p>
          <p>그러나 시간이 지나면 이 작은 종이 한 장이 그 시대의 음악 문화를 가장 생생하게 전해주는 자료가 됩니다. 누가 어떤 곡을 골랐는지, 누구와 함께 무대에 섰는지, 어떤 공간에서 어떤 청중을 만났는지 — <strong style={{ color: 'var(--ink)' }}>에페메라는 악보가 말하지 못하는 이야기</strong>를 담고 있습니다.</p>
        </div>
      </section>

      {/* What we do */}
      <section style={{ padding: '60px 56px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.2em' }}>● WHAT WE DO</div>
        <div style={{ fontSize: 20, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginTop: 0 }}>KoVox는 2016년부터 현재까지 한국에서 열린 <strong style={{ color: 'var(--ink)' }}>클래식 독창회 1,300여 건</strong>의 공연 정보, 프로그램, 출연진, 에페메라를 수집하고 있습니다.</p>
          <p>단순한 목록을 넘어, 성악가와 반주자의 관계, 레퍼토리의 흐름, 작곡가별 연주 경향까지 — 흩어져 있던 기록들을 연결하여 <strong style={{ color: 'var(--ink)' }}>한국 독창회 문화의 전체 그림</strong>을 그립니다.</p>
        </div>
      </section>

      {/* For whom */}
      <section style={{ padding: '60px 56px', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.2em' }}>● FOR WHOM</div>
        <div style={{ fontSize: 20, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginTop: 0 }}>이 아카이브는 모두를 위한 것입니다. <strong style={{ color: 'var(--ink)' }}>성악가</strong>에게는 프로그램을 설계할 때 참고할 수 있는 레퍼토리 데이터베이스가 되고, <strong style={{ color: 'var(--ink)' }}>반주자</strong>에게는 자신의 커리어를 한눈에 볼 수 있는 포트폴리오가 됩니다.</p>
          <p><strong style={{ color: 'var(--ink)' }}>클래식 음악 팬</strong>에게는 좋아하는 성악가의 공연 이력을 탐색하는 즐거움을, <strong style={{ color: 'var(--ink)' }}>연구자</strong>에게는 한국 독창회 문화를 분석할 수 있는 구조화된 데이터를 제공합니다.</p>
          <p>누구든 공연 정보를 등록할 수 있습니다. KoVox는 큐레이팅된 출판물이자, <strong style={{ color: 'var(--ink)' }}>누구나 기여할 수 있는 열린 아카이브</strong>입니다.</p>
        </div>
      </section>

      {/* Quote block */}
      <section style={{ padding: '80px 56px', borderTop: '1px solid var(--rule)', textAlign: 'center' }}>
        <blockquote style={{ fontSize: 28, lineHeight: 1.6, color: 'var(--ink)', maxWidth: 900, marginInline: 'auto', fontStyle: 'italic' }}>
          "음악은 그냥 뚝딱 생겨난 것이 아니다. 우리가 만드는 것이고 우리가 이해하는 것이다. 사람들은 음악을 통해 사고하고, 자신이 어떤 존재인지 결정하며, 스스로를 표현한다."
        </blockquote>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 20, letterSpacing: '0.15em' }}>NICHOLAS COOK, MUSIC: A VERY SHORT INTRODUCTION</div>
      </section>

      {/* Credits */}
      <section style={{ padding: '40px 56px 80px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40, borderTop: '1px solid var(--rule)' }}>
        {[['CURATOR', 'Minji Kim', 'Seoul National University'], ['DESIGN', 'Happy Hill', '2024 — Present'], ['ENGINE', 'KoVox / VIKUS', 'Pietsch, 2018']].map(([k, v, sub]) => (
          <div key={k}>
            <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 12 }}>● {k}</div>
            <div className="display" style={{ fontSize: 32, letterSpacing: '-0.02em' }}>{v}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>{sub}</div>
          </div>
        ))}
      </section>

      <footer style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)' }}>
        <div className="mono">KOVOX · 2026 · CURATED BY MINJI KIM</div>
        <div className="mono">A LIVING ARCHIVE OF KOREAN RECITALS</div>
      </footer>
    </div>
  );
}

window.KoVoxPages = { Archive, Composers, Singers, Calendar, Detail, Contribute, Editorial, About };
