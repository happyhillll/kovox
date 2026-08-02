/* global React, KOVOX_DATA */
const { useState: useSL, useEffect: useEL, useMemo: useML, useRef: useRL } = React;

/* ============== SHARED COUNT-UP PROGRESS ============== */
function useCountUp(duration = 1400) {
  const [prog, setProg] = useSL(0);
  useEL(() => {
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const x = Math.min(1, (t - t0) / duration);
      setProg(1 - Math.pow(1 - x, 3));
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return prog;
}
const fmt = (n) => (n || 0).toLocaleString('en-US');

/* ============== LANDING DATA (from KOVOX_RDB) ============== */
function buildLandingData() {
  const RDB = window.KOVOX_RDB;
  if (!RDB) return null;

  const personById = {};
  RDB.persons.forEach(p => { personById[p.person_id] = p; });

  const workById = {};
  RDB.works.forEach(w => { workById[w.work_id] = w; });

  // participations → distinct performances per person, main performer per performance
  const perfIdsByPerson = {};
  const mainByPerf = {};
  RDB.participations.forEach(pa => {
    (perfIdsByPerson[pa.person_id] = perfIdsByPerson[pa.person_id] || new Set()).add(pa.performance_id);
    if (!mainByPerf[pa.performance_id]) {
      const person = personById[pa.person_id];
      if (person && person.person_role === 'main performer') mainByPerf[pa.performance_id] = person;
    }
  });

  // stage counts per work (program items, excluding intermissions)
  const workCount = {};
  const sungWorkIds = new Set();
  RDB.programs.forEach(pr => {
    if (String(pr.is_intermission).toUpperCase() === 'TRUE' || !pr.work_id) return;
    sungWorkIds.add(pr.work_id);
    workCount[pr.work_id] = (workCount[pr.work_id] || 0) + 1;
  });
  const topWorks = Object.entries(workCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([wid, count]) => {
      const w = workById[wid] || {};
      return { id: wid, title: w.mb_title || w.title_variant || wid, composer: w.mb_composer || '—', count };
    });

  const rankPersons = (role) => RDB.persons
    .filter(p => p.person_role === role)
    .map(p => ({ p, c: (perfIdsByPerson[p.person_id] || new Set()).size }))
    .filter(x => x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 5);

  const topSingers = rankPersons('main performer');
  const topAccompanists = rankPersons('accompanist');

  const venues = new Set();
  const years = {};
  RDB.performances.forEach(p => {
    if (p.venue_name) venues.add(p.venue_name);
    const y = (p.performance_date || '').slice(0, 4);
    if (y) years[y] = (years[y] || 0) + 1;
  });

  const sorted = [...RDB.performances].sort((a, b) => (b.performance_date || '').localeCompare(a.performance_date || ''));
  const singerCount = RDB.persons.filter(p => p.person_role === 'main performer').length;

  return {
    total: RDB.performances.length,
    singers: singerCount,
    worksSung: sungWorkIds.size,
    venues: venues.size,
    years: Object.entries(years).sort(),
    topWorks, topSingers, topAccompanists,
    sorted, mainByPerf,
  };
}

/* ============== NAV ============== */
const NAV_ITEMS = [
  { label: 'Performances', href: '#/performances' },
  { label: 'Singers', href: '#/singers' },
  { label: 'Composers', href: '#/composers' },
  { label: 'Works', href: '#/repertoire' },
  { label: 'Groups', href: '#/groups' },
  { label: 'Accompanist', href: '#/network' },
  { label: 'Archive', href: '#/archive' },
  { label: 'About', href: '#/about' }
];

function NavL() {
  const [sidebarOpen, setSidebarOpen] = useSL(false);
  const SidebarComp = window.KoVoxPages && window.KoVoxPages.Sidebar;
  return (
    <React.Fragment>
      {SidebarComp && <SidebarComp open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '0 56px', height: 64, background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >{'☰'}</button>
          <a href="#/" className="display" style={{ fontSize: 22, letterSpacing: '-0.04em', color: 'var(--ink)', textDecoration: 'none' }}>
            KO<span style={{ color: 'var(--coral)' }}>VOX</span>
          </a>
        </div>
        <nav className="kvl-nav" style={{ display: 'flex', alignItems: 'center', gap: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {NAV_ITEMS.map(x => <a key={x.label} href={x.href} style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>{x.label}</a>)}
        </nav>
        <a href="#/search" className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink-soft)', textDecoration: 'none' }}>{'⌕'} SEARCH</a>
      </header>
    </React.Fragment>
  );
}

/* ============== SECTION EYEBROW ============== */
function Eyebrow({ children }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.26em', color: 'var(--ink-soft)', marginBottom: 16 }}>
      <span style={{ color: 'var(--coral)' }}>●</span> {children}
    </div>
  );
}

/* ============== HERO (voice-wave) ============== */
function Hero({ total, prog }) {
  const heroMove = (e) => {
    const host = e.currentTarget, mx = e.clientX;
    host.querySelectorAll('[data-kvl]').forEach(el => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(mx - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / 300);
      el.style.transform = t ? `translateY(${(-42 * t * t).toFixed(1)}px)` : '';
      el.style.color = t > 0.55 ? 'var(--coral)' : (el.dataset.c || '');
    });
    const bars = host.querySelector('[data-kv-waves]');
    if (bars) {
      const br = bars.getBoundingClientRect();
      [...bars.children].forEach((b, i, arr) => {
        const bx = br.left + (i + 0.5) * br.width / arr.length;
        const d = Math.abs(mx - bx);
        const g = Math.exp(-(d * d) / (2 * 120 * 120));
        const jitter = 0.55 + 0.45 * Math.abs(Math.sin(i * 2.7));
        b.style.height = (6 + g * 58 * jitter).toFixed(0) + 'px';
        b.style.background = g > 0.25 ? 'var(--coral)' : 'var(--rule)';
      });
    }
  };
  const heroLeave = (e) => {
    e.currentTarget.querySelectorAll('[data-kvl]').forEach(el => { el.style.transform = ''; el.style.color = el.dataset.c || ''; });
    const bars = e.currentTarget.querySelector('[data-kv-waves]');
    if (bars) [...bars.children].forEach(b => { b.style.height = '6px'; b.style.background = 'var(--rule)'; });
  };

  const letters = 'KOVOX'.split('').map((ch, i) => ({ ch, color: i >= 2 ? 'var(--coral)' : 'var(--ink)' }));

  return (
    <section className="kvl-sec" onMouseMove={heroMove} onMouseLeave={heroLeave} style={{ padding: '110px 56px 72px', borderBottom: '1px solid var(--rule)', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.28em', color: 'var(--ink-soft)', marginBottom: 36, animation: 'kvFadeIn 0.6s both', textAlign: 'center' }}>
        <span style={{ color: 'var(--coral)' }}>●</span><span>A LIVING ARCHIVE OF KOREAN RECITALS / 2016 — present</span>
      </div>
      <h1 style={{ margin: 0, textAlign: 'center', fontFamily: 'Archivo Black, sans-serif', fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 0.9, fontSize: 'clamp(96px, 13.5vw, 210px)', animation: 'kvFadeUp 0.7s cubic-bezier(.2,.7,.2,1) both' }}>
        {letters.map((l, i) => (
          <span key={i} data-kvl="1" data-c={l.color} style={{ display: 'inline-block', whiteSpace: 'pre', color: l.color, transition: 'transform 0.35s cubic-bezier(.2,.7,.2,1), color 0.35s', willChange: 'transform' }}>{l.ch}</span>
        ))}
      </h1>
      <div data-kv-waves="1" style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 64, marginTop: 44, animation: 'kvFadeIn 0.7s 0.2s both' }}>
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 6, background: 'var(--rule)', transition: 'height 0.2s cubic-bezier(.2,.7,.2,1), background 0.2s' }} />
        ))}
      </div>
      <div style={{ margin: '40px auto 0', textAlign: 'center', fontSize: 19, color: 'var(--ink-soft)', maxWidth: 720, textWrap: 'pretty', animation: 'kvFadeUp 0.7s 0.25s cubic-bezier(.2,.7,.2,1) both' }}>국내 모든 독창회를 기록합니다.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', gap: '16px 24px', marginTop: 48, borderTop: '1px solid var(--rule)', paddingTop: 28, animation: 'kvFadeUp 0.7s 0.4s cubic-bezier(.2,.7,.2,1) both' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.22em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>지금까지 집계된 전국 독창회 개수 :</span>
        <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--coral)' }}>{fmt(Math.round(total * prog))}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>SINCE 2016 — AND COUNTING</span>
      </div>
    </section>
  );
}

/* ============== LIVE TICKER ============== */
function Ticker({ items }) {
  const doubled = items.concat(items);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--rule)', overflow: 'hidden' }}>
      <div className="kvl-ticker-label" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px 14px 56px', borderRight: '1px solid var(--rule)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.22em', color: 'var(--coral)', background: 'var(--bg-deep)' }}>
        <span style={{ animation: 'kvPulse 1.6s infinite' }}>●</span> LIVE — 최근 기록
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', background: 'var(--bg-deep)' }}>
        <div style={{ display: 'flex', flex: 'none', animation: 'kvMarquee 55s linear infinite', whiteSpace: 'nowrap' }}>
          {doubled.map((t, i) => (
            <a key={i} href={t.href} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, padding: '14px 28px', fontSize: 13, color: 'var(--ink-soft)', textDecoration: 'none' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{t.date}</span>
              <span style={{ color: 'var(--ink)' }}>{t.title}</span>
              <span style={{ color: 'var(--rule)' }}>·</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============== RANK ROW ============== */
function PersonRankRows({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((r, i) => (
        <a key={r.p.person_id} href={'#/singer/' + r.p.person_id} className="kvl-hover" style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto auto', alignItems: 'baseline', gap: 16, padding: '16px 0', borderTop: '1px solid var(--rule)', color: 'var(--ink)', textDecoration: 'none' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: i === 0 ? 'var(--coral)' : 'var(--ink-soft)' }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{r.p.person_name}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{r.p.person_medium || ''}</span>
          <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 22, color: 'var(--coral)' }}>{fmt(r.c)}</span>
        </a>
      ))}
    </div>
  );
}

/* ============== YEAR CHART (scrub) ============== */
function YearChart({ years, total }) {
  const yMax = Math.max(...years.map(y => y[1]));
  const lastYear = years.length ? years[years.length - 1][0] : '';
  const defaultSub = years.length ? `${years[0][0]} — ${lastYear} 누적 독창회 · 좌우로 훑어보세요` : '';

  const yearMove = (e) => {
    const host = e.currentTarget;
    const chart = host.querySelector('[data-kvchart]'); if (!chart) return;
    const cr = chart.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - cr.left) / cr.width));
    const idx = Math.min(years.length - 1, Math.floor(f * years.length));
    let cum = 0; for (let i = 0; i <= idx; i++) cum += years[i][1];
    const read = host.querySelector('[data-kvyread]'), sub = host.querySelector('[data-kvyreadsub]');
    if (read) read.textContent = fmt(cum);
    if (sub) sub.textContent = years[idx][0] + '년까지 누적 · 해당 연도 ' + years[idx][1] + '회';
    host.querySelectorAll('[data-kvybar]').forEach((b, i) => { b.style.background = i <= idx ? 'var(--coral)' : 'var(--rule)'; });
    host.querySelectorAll('[data-kvynum]').forEach((n, i) => { n.style.color = i <= idx ? 'var(--coral)' : 'var(--ink-soft)'; });
  };
  const yearLeave = (e) => {
    const host = e.currentTarget;
    const read = host.querySelector('[data-kvyread]'), sub = host.querySelector('[data-kvyreadsub]');
    if (read) read.textContent = fmt(total);
    if (sub) sub.textContent = defaultSub;
    host.querySelectorAll('[data-kvybar]').forEach(b => { b.style.background = b.dataset.hot === '1' ? 'var(--coral)' : 'var(--rule)'; });
    host.querySelectorAll('[data-kvynum]').forEach(n => { n.style.color = n.dataset.hot === '1' ? 'var(--coral)' : 'var(--ink-soft)'; });
  };

  const cols = { display: 'grid', gridTemplateColumns: `repeat(${years.length}, 1fr)`, gap: 12 };

  return (
    <section className="kvl-sec" onMouseMove={yearMove} onMouseLeave={yearLeave} style={{ padding: '96px 56px', borderBottom: '1px solid var(--rule)', cursor: 'ew-resize' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 56 }}>
        <a href="#/archive" style={{ display: 'block', color: 'var(--ink)', textDecoration: 'none' }}>
          <Eyebrow>THE PULSE / {years.length ? years[0][0] : ''} — {lastYear}</Eyebrow>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em' }}>연도 별 공연 집계 현황 <span style={{ color: 'var(--coral)', fontSize: 28 }}>→</span></h2>
        </a>
        <div style={{ textAlign: 'right' }}>
          <div data-kvyread="1" style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 72, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--coral)' }}>{fmt(total)}</div>
          <div data-kvyreadsub="1" style={{ marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>{defaultSub}</div>
        </div>
      </div>
      <div data-kvchart="1" style={{ ...cols, alignItems: 'end', height: 220 }}>
        {years.map(([year, count]) => {
          const hot = year === lastYear;
          return (
            <div key={year} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 220, gap: 10 }}>
              <div data-kvynum="1" data-hot={hot ? '1' : '0'} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: hot ? 'var(--coral)' : 'var(--ink-soft)', textAlign: 'center' }}>{count}</div>
              <div data-kvybar="1" data-hot={hot ? '1' : '0'} style={{ height: Math.round(count / yMax * 168), background: hot ? 'var(--coral)' : 'var(--rule)', transformOrigin: 'bottom', animation: 'kvBarUp 0.8s cubic-bezier(.2,.7,.2,1) both', transition: 'background 0.15s' }} />
            </div>
          );
        })}
      </div>
      <div style={{ ...cols, marginTop: 12, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
        {years.map(([year]) => {
          const hot = year === lastYear;
          return <div key={year} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', color: hot ? 'var(--coral)' : 'var(--ink-soft)', textAlign: 'center' }}>{year}</div>;
        })}
      </div>
    </section>
  );
}

/* ============== LANDING ============== */
function Landing() {
  const D = useML(buildLandingData, []);
  const prog = useCountUp();
  if (!D) return null;

  const statCells = [
    { v: D.total, label: 'RECITALS ARCHIVED', kr: '기록된 독창회', href: '#/performances' },
    { v: D.singers, label: 'SINGERS', kr: '성악가', href: '#/singers' },
    { v: D.worksSung, label: 'WORKS SUNG', kr: '무대에 오른 작품', href: '#/repertoire' },
    { v: D.venues, label: 'VENUES', kr: '공연장', href: '#/performances' },
  ];

  const perfHref = (p) => '#/detail/' + p.performance_id.replace('PERF_', '');
  const perfVoice = (p) => {
    const main = D.mainByPerf[p.performance_id];
    return main && main.person_medium ? main.person_medium : '';
  };

  const tickerItems = D.sorted.slice(0, 14).map(p => ({ href: perfHref(p), date: p.performance_date, title: p.performance_title }));
  const recentRows = D.sorted.slice(0, 8);

  return (
    <div className="kv2" style={{ width: '100%', minHeight: '100vh', background: 'var(--bg)' }}>
      <NavL />
      <main>
        {/* 히어로 카운터는 고정값 표시 (전체 집계와 별도) */}
        <Hero total={1319} prog={prog} />
        <Ticker items={tickerItems} />

        {/* STAT GRID */}
        <section className="kvl-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--rule)' }}>
          {statCells.map((s, i) => (
            <a key={s.label} href={s.href} className="kvl-hover" style={{ display: 'block', color: 'var(--ink)', textDecoration: 'none', padding: i === 0 ? '64px 40px 56px 56px' : '64px 40px 56px', borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}>
              <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 'clamp(56px, 6vw, 92px)', lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--coral)' }}>{fmt(Math.round(s.v * prog))}</div>
              <div style={{ marginTop: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{s.label}</div>
              <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ink)' }}>{s.kr}</div>
            </a>
          ))}
        </section>

        {/* WORK RANKING + PEOPLE */}
        <section className="kvl-rank-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', borderBottom: '1px solid var(--rule)' }}>
          <div className="kvl-sec kvl-rank-left" style={{ padding: '96px 56px', borderRight: '1px solid var(--rule)' }}>
            <Eyebrow>MOST SUNG WORKS / 작품 순위</Eyebrow>
            <a href="#/repertoire" style={{ display: 'block', color: 'var(--ink)', textDecoration: 'none' }}>
              <h2 style={{ margin: '0 0 12px', fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em' }}>가장 많이 공연된 작품 <span style={{ color: 'var(--coral)', fontSize: 28 }}>→</span></h2>
            </a>
            <p style={{ margin: '0 0 48px', fontSize: 16, color: 'var(--ink-soft)', textWrap: 'pretty' }}>지난 10년의 실제 프로그램에서 집계 — 무대에 오른 횟수 기준입니다.</p>
            <div>
              {D.topWorks.map((w, i) => (
                <a key={w.id} href={'#/work/' + w.id} className="kvl-hover" style={{ display: 'grid', gridTemplateColumns: '44px 1fr 64px', alignItems: 'center', gap: 20, padding: '14px 0', borderTop: '1px solid var(--rule)', color: 'var(--ink)', textDecoration: 'none' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: i === 0 ? 'var(--coral)' : 'var(--ink-soft)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ display: 'block', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
                    <span style={{ display: 'block', marginTop: 3, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{w.composer}</span>
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--coral)', textAlign: 'right' }}>{w.count}</span>
                </a>
              ))}
            </div>
          </div>
          <div className="kvl-sec" style={{ padding: '96px 56px', display: 'flex', flexDirection: 'column' }}>
            <Eyebrow>MOST RECORDED / 사람들</Eyebrow>
            <a href="#/singers" style={{ display: 'block', color: 'var(--ink)', textDecoration: 'none' }}>
              <h2 style={{ margin: '0 0 40px', fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em' }}>성악가 공연 현황 <span style={{ color: 'var(--coral)', fontSize: 28 }}>→</span></h2>
            </a>
            <PersonRankRows rows={D.topSingers} />
            <div style={{ marginTop: 48 }}>
              <Eyebrow>ACCOMPANISTS</Eyebrow>
              <a href="#/network" style={{ display: 'block', color: 'var(--ink)', textDecoration: 'none' }}>
                <h2 style={{ margin: '0 0 24px', fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em' }}>반주자 공연 현황 <span style={{ color: 'var(--coral)', fontSize: 28 }}>→</span></h2>
              </a>
              <PersonRankRows rows={D.topAccompanists} />
            </div>
          </div>
        </section>

        <YearChart years={D.years} total={D.total} />

        {/* RECENT PERFORMANCES */}
        <section className="kvl-sec" style={{ padding: '96px 56px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 48 }}>
            <div>
              <Eyebrow>LATEST ENTRIES</Eyebrow>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: 44, letterSpacing: '-0.04em' }}>최근 등록된 공연</h2>
            </div>
            <a href="#/performances" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.2em', color: 'var(--coral)', textDecoration: 'none' }}>전체 공연 보기 →</a>
          </div>
          <div>
            {recentRows.map(p => (
              <a key={p.performance_id} href={perfHref(p)} className="kvl-hover kvl-recent-row" style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 240px 24px', alignItems: 'center', gap: 24, padding: '18px 0', borderTop: '1px solid var(--rule)', color: 'var(--ink)', textDecoration: 'none' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-soft)' }}>{p.performance_date}</span>
                <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.performance_title}</span>
                <span className="kvl-recent-voice" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'var(--coral)', textTransform: 'uppercase' }}>{perfVoice(p)}</span>
                <span className="kvl-recent-venue" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.08em', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.venue_name || ''}</span>
                <span style={{ color: 'var(--coral)' }}>→</span>
              </a>
            ))}
          </div>
        </section>

        {/* CONTRIBUTE CTA */}
        <section className="kvl-sec" style={{ background: 'var(--bg-deep)', padding: '130px 56px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', gap: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.26em', color: 'var(--ink-soft)', marginBottom: 24 }}>
            <span style={{ color: 'var(--coral)' }}>●</span> CONTRIBUTE / 공연 등록
          </div>
          <h2 style={{ margin: '0 0 56px', fontWeight: 900, fontSize: 'clamp(44px, 5.5vw, 76px)', letterSpacing: '-0.045em', lineHeight: 1.05, maxWidth: 900, textWrap: 'pretty' }}>
            당신의 무대가<br />아카이브의 <span style={{ color: 'var(--coral)' }}>일부</span>가 됩니다.
          </h2>
          <div className="kvl-cta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 56, alignItems: 'start' }}>
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 20 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--coral)', marginBottom: 12 }}>01 — 홍보가 됩니다</div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--ink-soft)', textWrap: 'pretty' }}>등록된 공연은 아카이브·캘린더에 즉시 노출됩니다. 전공생과 기획자, 관객이 매일 드나드는 곳에 당신의 무대를 알리세요.</p>
            </div>
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 20 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--coral)', marginBottom: 12 }}>02 — 기록이 됩니다</div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--ink-soft)', textWrap: 'pretty' }}>한 건의 등록이 통계가 되고, 한국 성악의 10년을 증명하는 데이터가 됩니다. 연주되지 않은 음악은 음악이 아니듯, 기록되지 않은 무대는 잊혀집니다.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <a href="#/contribute" className="kv2-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '20px 32px' }}>공연 등록하기 →</a>
              <div style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-soft)' }}>누구나 등록할 수 있습니다 — 무료</div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', padding: '40px 56px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink-soft)' }}>
        <span>KOVOX · 2026 · CURATED BY MINJI KIM</span>
        <span>SINCE 2016 — {fmt(D.total)} RECITALS · {fmt(D.singers)} VOICES</span>
      </footer>
    </div>
  );
}

window.KoVoxLanding = Landing;
