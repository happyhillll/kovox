/* global React, KOVOX_DATA */
const { useState: useSL, useEffect: useEL } = React;
const D_L = window.KOVOX_DATA;

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
  { label: 'Archive', href: '#/archive' },
  { label: 'Composers', href: '#/composers' },
  { label: 'Singers', href: '#/singers' },
  { label: 'Calendar', href: '#/calendar' },
  { label: 'Editorial', href: '#/editorial' },
  { label: 'Contribute', href: '#/contribute' },
  { label: 'About', href: '#/about' }
];

const NavL = () => (
  <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px', borderBottom: '1px solid var(--rule)' }}>
    <a href="#/" className="display" style={{ fontSize: 20, color: 'var(--ink)', textDecoration: 'none' }}>KO<span style={{ color: 'var(--coral)' }}>VOX</span></a>
    <nav style={{ display: 'flex', gap: 32, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {NAV_ITEMS.map(x => <a key={x.label} href={x.href} style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>{x.label}</a>)}
    </nav>
    <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>⌕ SEARCH</div>
  </header>
);

function Landing() {
  const S = D_L.stats;
  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <NavL />
      <section style={{ padding: '40px 0 0' }}><KineticHero /></section>
      <section style={{ padding: '0 56px 80px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--rule)' }}>
        {[[String(S.totalRecitals), 'RECITALS'], [String(S.totalSingers), 'SINGERS'], [String(S.totalComposers), 'COMPOSERS'], [S.yearSpan, 'SPAN']].map(([n, l], i) => (
          <div key={l} style={{ padding: '40px 24px', borderRight: i < 3 ? '1px solid var(--rule)' : 'none' }}>
            <div className="display coral" style={{ fontSize: 88, lineHeight: 0.9 }}>{n}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 12, letterSpacing: '0.2em' }}>{l}</div>
          </div>
        ))}
      </section>
      <section style={{ padding: '80px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 40 }}>
          <h3 className="display" style={{ fontSize: 56, margin: 0 }}>COMPOSERS <span className="coral">{S.totalComposers}</span></h3>
          <a href="#/composers" className="mono coral" style={{ fontSize: 13, letterSpacing: '0.1em', textDecoration: 'none' }}>VIEW ALL →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 64px' }}>
          {D_L.composers.slice(0, 12).map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--rule)' }}>
              <span className="display coral" style={{ fontSize: 32 }}>{c.name.toUpperCase()}</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{c.count} recitals</span>
            </div>
          ))}
        </div>
      </section>
      <section style={{ padding: '60px 56px', background: 'var(--bg-deep)' }}>
        <h3 className="display" style={{ fontSize: 56, margin: '0 0 40px' }}>RECENT <span className="coral">RECITALS</span></h3>
        {D_L.performances.slice(0, 10).map(p => (
          <a key={p.id} href={'#/detail/' + p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px 100px 60px', gap: 24, padding: '22px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.date}</span>
            <span className="display-kr" style={{ fontSize: 24 }}>{p.title}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.venue}</span>
            <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em' }}>{p.voice.toUpperCase()}</span>
            <span className="coral" style={{ fontSize: 22, textAlign: 'right' }}>→</span>
          </a>
        ))}
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
