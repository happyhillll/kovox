/* global React, KOVOX_DATA, d3 */
const { useState: useSL, useEffect: useEL } = React;
const D_L = window.KOVOX_DATA;

/* ============== COUNTER ANIMATION ============== */
function AnimatedNumber({ value, duration = 1800 }) {
  const num = parseInt(value) || 0;
  const suffix = String(value).replace(/^\d+/, '');
  const [display, setDisplay] = useSL(0);
  const [done, setDone] = useSL(false);
  useEL(() => {
    if (num === 0) return;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * num));
      if (progress < 1) { raf = requestAnimationFrame(step); }
      else { setDone(true); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [num, duration]);
  return React.createElement('span', null, (done ? num : display) + suffix);
}

/* ============== KINETIC HERO ============== */
function KineticHero() {
  const [step, setStep] = useSL(0);
  const [tick, setTick] = useSL(0);
  useEL(() => {
    const seq = [1800, 2400, 2200, 2400];
    const t = setTimeout(() => { setStep(s => (s + 1) % 4); setTick(x => x + 1); }, seq[step]);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="kv-hero-stage" key={tick}>
      <div className={`kv-hero-step kv-hero-step-1 ${step === 0 ? 'active' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 32 }}>
          <span className="ko">KO</span><span className="vox">VOX</span>
        </div>
      </div>
      <div className={`kv-hero-step kv-hero-step-2 ${step === 1 ? 'active' : ''}`}>
        <div className="label-row">
          <span style={{ color: 'var(--coral)' }}>● KO</span>
          <span>━━━━━━━━━━━━━━━━━</span>
          <span>한국에서 / FROM KOREA</span>
        </div>
        <div className="word">KO</div>
        <div className="meaning">한국 韓國</div>
      </div>
      <div className={`kv-hero-step kv-hero-step-2 ${step === 2 ? 'active' : ''}`}>
        <div className="label-row">
          <span style={{ color: 'var(--coral)' }}>● VOX</span>
          <span>━━━━━━━━━━━━━━━━━</span>
          <span>라틴어 / LATIN — voice</span>
        </div>
        <div className="word" style={{ color: 'var(--coral)' }}>VOX</div>
        <div className="meaning" style={{ color: 'var(--ink)' }}>목소리 · the voice</div>
      </div>
      <div className={`kv-hero-step kv-hero-step-3 ${step === 3 ? 'active' : ''}`}>
        <div className="stack">
          <div className="top">KO<span className="vox-c">VOX</span></div>
          <div className="tag">한국의 모든 독창회를 기록합니다 — A Living Archive of Korean Recitals</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width: i === step ? 32 : 8, height: 4, background: i === step ? 'var(--coral)' : 'var(--rule)', transition: 'all 0.4s' }} />)}
      </div>
    </div>
  );
}

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
  return React.createElement(React.Fragment, null,
    SidebarComp && React.createElement(SidebarComp, { open: sidebarOpen, onClose: () => setSidebarOpen(false) }),
    React.createElement('header', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px', borderBottom: '1px solid var(--rule)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 20 } },
        React.createElement('button', {
          onClick: () => setSidebarOpen(true),
          style: { background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }
        }, '\u2630'),
        React.createElement('a', { href: '#/', className: 'display', style: { fontSize: 20, color: 'var(--ink)', textDecoration: 'none' } },
          'KO', React.createElement('span', { style: { color: 'var(--coral)' } }, 'VOX')
        )
      ),
      React.createElement('nav', { style: { display: 'flex', gap: 32, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' } },
        NAV_ITEMS.map(x => React.createElement('a', { key: x.label, href: x.href, style: { color: 'var(--ink-soft)', textDecoration: 'none' } }, x.label))
      ),
      React.createElement('a', { href: '#/search', className: 'mono', style: { fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', cursor: 'pointer' } }, '\u2315 SEARCH')
    )
  );
}

function Landing() {
  const RDB = window.KOVOX_RDB;
  const rdbStats = RDB ? {
    totalPerfs: 1319,
    totalSingers: RDB.persons.filter(p => p.person_role === 'main performer').length,
    totalAccompanists: RDB.persons.filter(p => p.person_role === 'accompanist').length,
    totalWorks: RDB.works.length,
    totalComposers: new Set(RDB.works.map(w => w.mb_composer).filter(Boolean)).size,
    totalVenues: new Set(RDB.performances.map(p => p.venue_name).filter(Boolean)).size
  } : null;
  const S = rdbStats || D_L.stats;
  const yearChartRef = React.useRef(null);

  // Year distribution for mini chart
  useEL(() => {
    if (!yearChartRef.current || !RDB) return;
    const svg = d3.select(yearChartRef.current);
    svg.selectAll('*').remove();
    const yearCount = {};
    RDB.performances.forEach(p => {
      if (p.performance_date) {
        const y = p.performance_date.slice(0, 4);
        yearCount[y] = (yearCount[y] || 0) + 1;
      }
    });
    const years = Object.keys(yearCount).sort();
    const w = yearChartRef.current.clientWidth, h = 160;
    const m = { top: 10, right: 10, bottom: 24, left: 10 };
    const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = d3.scaleBand().domain(years).range([0, iw]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(years, yr => yearCount[yr])]).nice().range([ih, 0]);
    g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0)).selectAll('text').style('fill', '#888').style('font-size', '10px');
    g.selectAll('.domain').style('stroke', '#444');
    g.selectAll('rect').data(years).enter().append('rect')
      .attr('x', yr => x(yr)).attr('y', yr => y(yearCount[yr])).attr('width', x.bandwidth()).attr('height', yr => ih - y(yearCount[yr]))
      .attr('fill', '#f57b6b').attr('rx', 2);
    g.selectAll('.label').data(years).enter().append('text')
      .attr('x', yr => x(yr) + x.bandwidth() / 2).attr('y', yr => y(yearCount[yr]) - 4)
      .attr('text-anchor', 'middle').style('fill', '#f4ede2').style('font-size', '9px').style('font-family', 'JetBrains Mono')
      .text(yr => yearCount[yr]);
  }, []);

  // Random posters for showcase
  const showcasePerfs = React.useMemo(() => {
    if (!RDB) return [];
    const shuffled = [...RDB.performances].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }, []);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <NavL />
      <section style={{ padding: '40px 0 0' }}><KineticHero /></section>

      {/* Stats */}
      <section style={{ padding: '0 56px 0', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderTop: '1px solid var(--rule)' }}>
        {[
          [String(S.totalPerfs || S.totalRecitals), 'RECITALS'],
          [String(S.totalSingers), 'SINGERS'],
          [String(S.totalAccompanists || '—'), 'ACCOMPANISTS'],
          [String(S.totalWorks || '—'), 'WORKS'],
          [String(S.totalComposers), 'COMPOSERS'],
          [String(S.totalVenues || '—'), 'VENUES']
        ].map(([n, l], i) => (
          <div key={l} style={{ padding: '32px 16px', borderRight: i < 5 ? '1px solid var(--rule)' : 'none' }}>
            <div className="display coral" style={{ fontSize: 56, lineHeight: 0.9 }}><AnimatedNumber value={n} duration={1800} /></div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 10, letterSpacing: '0.2em' }}>{l}</div>
          </div>
        ))}
      </section>

      {/* Year distribution chart */}
      <section style={{ padding: '40px 56px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em' }}>● PERFORMANCES BY YEAR</div>
          <a href="#/performances" className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em', textDecoration: 'none' }}>VIEW ALL →</a>
        </div>
        <svg ref={yearChartRef} style={{ width: '100%', height: 160 }} />
      </section>

      {/* Poster showcase */}
      <section style={{ padding: '48px 56px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em' }}>● FROM THE ARCHIVE</div>
          <a href="#/performances" className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em', textDecoration: 'none' }}>EXPLORE →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {showcasePerfs.slice(0, 4).map(p => {
            const id = p.performance_id.replace('PERF_', '');
            return (
              <a key={p.performance_id} href={'#/detail/' + id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', background: '#111', aspectRatio: '3/4', overflow: 'hidden', boxShadow: '2px 4px 16px rgba(0,0,0,0.4)' }}>
                  <img src={'viewer/data/thumbnails/' + id + '.gif'} alt={p.performance_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'viewer/data/1024/' + id + '.jpg'; }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.performance_date}</div>
                  <div className="display-kr" style={{ fontSize: 16, marginTop: 2, lineHeight: 1.3 }}>{p.performance_title}</div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Top singers */}
      <section style={{ padding: '48px 56px', background: 'var(--bg-deep)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <h3 className="display" style={{ fontSize: 48, margin: 0 }}>TOP <span className="coral">SINGERS</span></h3>
          <a href="#/singers" className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em', textDecoration: 'none' }}>VIEW ALL →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 48px' }}>
          {(RDB ? RDB.persons.filter(p => p.person_role === 'main performer').slice(0, 10) : D_L.performances.slice(0, 10)).map((item, i) => {
            const name = item.person_name || item.singer || '';
            const medium = item.person_medium || item.voice || '';
            const href = item.person_id ? '#/singer/' + item.person_id : '#/singers';
            return (
              <a key={i} href={href} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                <span className="display-kr" style={{ fontSize: 28 }}>{name}</span>
                <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em' }}>{medium.toUpperCase()}</span>
              </a>
            );
          })}
        </div>
      </section>
      <section style={{ padding: '120px 56px', textAlign: 'center', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.3em', marginBottom: 24 }}>CONTRIBUTE</div>
        <h2 className="display-kr" style={{ fontSize: 96, lineHeight: 0.95, margin: 0, maxWidth: 1100, marginInline: 'auto' }}>
          당신의 무대가<br /><span className="coral">아카이브의 일부</span>가 됩니다.
        </h2>
        <a href="#/contribute" className="kv2-btn" style={{ display: 'inline-block', marginTop: 48, padding: '22px 48px', fontSize: 16, textDecoration: 'none' }}>공연 등록하기 →</a>
      </section>
      <footer style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)' }}>
        <div className="mono">KOVOX · 2026 · CURATED BY MINJI KIM</div>
        <div className="mono">A LIVING ARCHIVE OF KOREAN RECITALS</div>
      </footer>
    </div>
  );
}

window.KoVoxLanding = Landing;
