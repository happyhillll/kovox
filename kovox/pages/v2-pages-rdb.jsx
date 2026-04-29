/* global React, KOVOX_DATA, KOVOX_RDB, d3 */
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR, useMemo: useMemoR } = React;
const RDB = window.KOVOX_RDB;

/* ================= LANGUAGE MAP ================= */
const LANG_NAMES = {
  deu: 'German', eng: 'English', fra: 'French', ita: 'Italian', rus: 'Russian',
  lat: 'Latin', spa: 'Spanish', nap: 'Neapolitan', ces: 'Czech', czech: 'Czech',
  nor: 'Norwegian', swe: 'Swedish', kor: 'Korean', pol: 'Polish', cat: 'Catalan',
  dan: 'Danish', chu: 'Church Slavonic', mul: 'Multilingual', zxx: 'No Lyrics',
  neapolitan: 'Neapolitan',
  'ita; nap': 'Italian / Neapolitan', 'deu; fra': 'German / French', 'deu; eng': 'German / English'
};
function langName(code) { return code ? (LANG_NAMES[code] || code) : ''; }

/* ================= MERGE USER SUBMISSIONS INTO RDB ================= */
function mergeUserSubmissions() {
  try {
    const subs = JSON.parse(localStorage.getItem('kovox_submissions') || '[]');
    subs.forEach(sub => {
      const perfId = sub.performance_id || ('PERF_' + sub.id);
      // Skip if already merged
      if (RDB.performances.find(p => p.performance_id === perfId)) return;

      // Add to RDB.performances
      RDB.performances.push({
        performance_id: perfId,
        performance_date: sub.performance_date || sub.date,
        performance_title: sub.performance_title || sub.title,
        venue_name: sub.venue_name || sub.venue,
        duration_minutes: sub.duration_minutes || null,
        start_time: sub.start_time || sub.startTime || null,
        host_organization: sub.host || null,
        sponsoring_organization: sub.sponsor || null,
        mt20id: null,
        performance_abstract: null,
        _user_submitted: true,
        _youtube: sub.youtube || null,
        _poster: sub.poster || null,
        _brochures: sub.brochures || []
      });

      // Add singer to RDB.persons
      const singer = sub.singer;
      if (singer && singer.name) {
        const singerId = 'PERSON_USER_' + sub.id + '_singer';
        if (!RDB.persons.find(p => p.person_id === singerId)) {
          RDB.persons.push({
            person_id: singerId,
            person_name: singer.name,
            person_role: 'main performer',
            person_medium: singer.medium || 'soprano',
            person_profile: singer.profile || null,
            person_isni: null
          });
          // Add participation
          RDB.participations.push({ performance_id: perfId, program_item_id: perfId + '_ITEM_0', person_id: singerId });
        }
      }

      // Add accompanist to RDB.persons
      const acc = sub.accompanist;
      if (acc && acc.name) {
        const accId = 'PERSON_USER_' + sub.id + '_acc';
        if (!RDB.persons.find(p => p.person_id === accId)) {
          RDB.persons.push({
            person_id: accId,
            person_name: acc.name,
            person_role: 'accompanist',
            person_medium: acc.medium || 'piano',
            person_profile: acc.profile || null,
            person_isni: null
          });
          RDB.participations.push({ performance_id: perfId, program_item_id: perfId + '_ITEM_0', person_id: accId });
        }
      }

      // Add program items
      const program = sub.program || [];
      program.forEach((item, idx) => {
        const progItemId = perfId + '_ITEM_' + idx;
        if (item.isIntermission) {
          RDB.programs.push({ program_item_id: progItemId, performance_id: perfId, work_id: null, program_order: idx, is_intermission: 'TRUE' });
        } else {
          let workId = item.work_id;
          // If custom or MB work, add to works table
          if (!workId && (item.source === 'custom' || item.source === 'musicbrainz')) {
            workId = 'WRK_USER_' + sub.id + '_' + idx;
            if (!RDB.works.find(w => w.work_id === workId)) {
              RDB.works.push({
                work_id: workId,
                title_variant: item.title,
                mb_title: item.title,
                mb_composer: item.composer || null,
                mb_language: item.language || null,
                mb_type: null, mb_composer_birth_year: null, mb_composer_death_year: null,
                mb_lyricist: null, mb_arranger: null, mbid: item.mbid || null,
                mb_parent_work_title: null, mbid_parent_work: null
              });
            }
          }
          RDB.programs.push({ program_item_id: progItemId, performance_id: perfId, work_id: workId, program_order: idx, is_intermission: 'FALSE' });
        }
      });

      // Also add to the flat D.performances (kovox-data.js) for Detail page compatibility
      const D_flat = window.KOVOX_DATA;
      if (D_flat && !D_flat.performances.find(p => String(p.id) === String(sub.id))) {
        const composers = program.filter(it => !it.isIntermission && it.composer).map(it => it.composer);
        D_flat.performances.push({
          id: sub.id,
          date: sub.performance_date || sub.date,
          title: sub.performance_title || sub.title,
          singer: singer ? singer.name : '',
          voice: singer ? (singer.medium || '') : '',
          venue: sub.venue_name || sub.venue,
          time: sub.start_time || sub.startTime || '',
          composers: [...new Set(composers)]
        });
      }
    });
  } catch (e) {
    console.error('Failed to merge user submissions:', e);
  }
}
mergeUserSubmissions();

/* ================= PRECOMPUTED INDEXES ================= */
const IX = (() => {
  const perfById = {};
  RDB.performances.forEach(p => { perfById[p.performance_id] = p; });

  const workById = {};
  RDB.works.forEach(w => { workById[w.work_id] = w; });

  const personById = {};
  RDB.persons.forEach(p => { personById[p.person_id] = p; });

  // program items grouped by performance
  const progByPerf = {};
  const progById = {};
  RDB.programs.forEach(pr => {
    if (!progByPerf[pr.performance_id]) progByPerf[pr.performance_id] = [];
    progByPerf[pr.performance_id].push(pr);
    progById[pr.program_item_id] = pr;
  });

  // participation grouped by person and by performance
  const partByPerson = {};
  const partByPerf = {};
  const partByProgItem = {};
  RDB.participations.forEach(pa => {
    if (!partByPerson[pa.person_id]) partByPerson[pa.person_id] = [];
    partByPerson[pa.person_id].push(pa);
    if (!partByPerf[pa.performance_id]) partByPerf[pa.performance_id] = [];
    partByPerf[pa.performance_id].push(pa);
    if (!partByProgItem[pa.program_item_id]) partByProgItem[pa.program_item_id] = [];
    partByProgItem[pa.program_item_id].push(pa);
  });

  // unique singers (main performers)
  const singers = RDB.persons.filter(p => p.person_role === 'main performer');

  // singer performance count
  const singerPerfCount = {};
  singers.forEach(s => {
    const parts = partByPerson[s.person_id] || [];
    const perfIds = new Set(parts.map(pa => pa.performance_id));
    singerPerfCount[s.person_id] = perfIds.size;
  });

  // sort singers by performance count
  singers.sort((a, b) => (singerPerfCount[b.person_id] || 0) - (singerPerfCount[a.person_id] || 0));

  return { perfById, workById, personById, progByPerf, progById, partByPerson, partByPerf, partByProgItem, singers, singerPerfCount };
})();

/* ================= HELPERS ================= */
function getPersonPerformances(personId) {
  const parts = IX.partByPerson[personId] || [];
  const perfIds = [...new Set(parts.map(pa => pa.performance_id))];
  return perfIds.map(pid => IX.perfById[pid]).filter(Boolean).sort((a, b) => (b.performance_date || '').localeCompare(a.performance_date || ''));
}

function getPersonWorks(personId) {
  const parts = IX.partByPerson[personId] || [];
  const workCount = {};
  parts.forEach(pa => {
    const prog = IX.progById[pa.program_item_id];
    if (prog && prog.work_id) {
      workCount[prog.work_id] = (workCount[prog.work_id] || 0) + 1;
    }
  });
  return Object.entries(workCount)
    .map(([wid, count]) => ({ work: IX.workById[wid], count }))
    .filter(x => x.work)
    .sort((a, b) => b.count - a.count);
}

function getPersonComposers(personId) {
  const works = getPersonWorks(personId);
  const composerCount = {};
  works.forEach(({ work, count }) => {
    const name = work.mb_composer || 'Unknown';
    composerCount[name] = (composerCount[name] || 0) + count;
  });
  return Object.entries(composerCount).sort((a, b) => b[1] - a[1]);
}

/* ================= PERSON PROFILE VISUALIZATIONS ================= */
function PersonViz({ personId }) {
  const heatmapRef = useRefR(null);
  const donutRef = useRefR(null);
  const treemapRef = useRefR(null);

  const vizData = useMemoR(() => {
    const person = IX.personById[personId];
    if (!person) return null;

    const parts = IX.partByPerson[personId] || [];
    const perfIds = [...new Set(parts.map(pa => pa.performance_id))];

    // 1. Heatmap data: year-month grid
    const monthCounts = {};
    let minYear = 9999, maxYear = 0;
    perfIds.forEach(pid => {
      const perf = IX.perfById[pid];
      if (!perf || !perf.performance_date) return;
      const ym = perf.performance_date.slice(0, 7);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
      const y = parseInt(perf.performance_date.slice(0, 4));
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    });

    // 2. Language distribution (donut)
    const langCounts = {};
    const workSet = new Set();
    parts.forEach(pa => {
      const prog = IX.progById[pa.program_item_id];
      if (prog && prog.work_id) workSet.add(prog.work_id);
    });
    workSet.forEach(wid => {
      const w = IX.workById[wid];
      if (w && w.mb_language) {
        const lang = langName(w.mb_language) || w.mb_language;
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
    });
    const langData = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);

    // 3. Composer treemap
    const composerCounts = {};
    workSet.forEach(wid => {
      const w = IX.workById[wid];
      if (w && w.mb_composer) {
        composerCounts[w.mb_composer] = (composerCounts[w.mb_composer] || 0) + 1;
      }
    });
    const composerData = Object.entries(composerCounts).sort((a, b) => b[1] - a[1]);

    return { monthCounts, minYear, maxYear, langData, composerData, perfCount: perfIds.length };
  }, [personId]);

  // Draw heatmap
  useEffectR(() => {
    if (!heatmapRef.current || !vizData || vizData.perfCount === 0) return;
    const svg = d3.select(heatmapRef.current);
    svg.selectAll('*').remove();

    const { monthCounts, minYear, maxYear } = vizData;
    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];

    const cellSize = 28, gap = 2;
    const mLeft = 50, mTop = 30;
    const w = mLeft + months.length * (cellSize + gap);
    const h = mTop + years.length * (cellSize + gap) + 10;
    svg.attr('width', w).attr('height', h).style('height', h + 'px');

    const maxCount = Math.max(...Object.values(monthCounts), 1);
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount]);

    // Month labels
    months.forEach((m, mi) => {
      svg.append('text').attr('x', mLeft + mi * (cellSize + gap) + cellSize / 2).attr('y', 18)
        .attr('text-anchor', 'middle').style('font-size', '9px').style('fill', '#666').style('font-family', 'JetBrains Mono')
        .text(m);
    });

    // Year labels + cells
    years.forEach((year, yi) => {
      svg.append('text').attr('x', mLeft - 8).attr('y', mTop + yi * (cellSize + gap) + cellSize / 2 + 3)
        .attr('text-anchor', 'end').style('font-size', '10px').style('fill', '#888').style('font-family', 'JetBrains Mono')
        .text(year);

      months.forEach((m, mi) => {
        const key = year + '-' + m;
        const count = monthCounts[key] || 0;
        const rect = svg.append('rect')
          .attr('x', mLeft + mi * (cellSize + gap)).attr('y', mTop + yi * (cellSize + gap))
          .attr('width', cellSize).attr('height', cellSize).attr('rx', 3)
          .attr('fill', count > 0 ? colorScale(count) : '#2a2826');
        if (count > 0) {
          svg.append('text')
            .attr('x', mLeft + mi * (cellSize + gap) + cellSize / 2)
            .attr('y', mTop + yi * (cellSize + gap) + cellSize / 2 + 3)
            .attr('text-anchor', 'middle').style('font-size', '9px').style('fill', '#1a1a1a').style('font-weight', '600').style('font-family', 'JetBrains Mono')
            .text(count);
        }
        rect.append('title').text(key + ': ' + count + ' performances');
      });
    });
  }, [vizData]);

  // Draw donut
  useEffectR(() => {
    if (!donutRef.current || !vizData || vizData.langData.length === 0) return;
    const svg = d3.select(donutRef.current);
    svg.selectAll('*').remove();

    const size = 220, radius = size / 2, inner = radius * 0.55;
    const colors = ['#f57b6b', '#e8c547', '#6bc5f5', '#8be88b', '#d48bf5', '#f5a06b', '#6bf5c5', '#f56b9b', '#b5e86b', '#6b9bf5'];
    const color = d3.scaleOrdinal().domain(vizData.langData.map(d => d[0])).range(colors);
    const total = vizData.langData.reduce((s, d) => s + d[1], 0);

    const pie = d3.pie().value(d => d[1]).sort(null);
    const arc = d3.arc().innerRadius(inner).outerRadius(radius);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const slices = g.selectAll('path').data(pie(vizData.langData)).enter().append('path')
      .attr('d', arc).attr('fill', d => color(d.data[0]))
      .attr('stroke', '#1f1d1b').attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // Center text
    g.append('text').attr('text-anchor', 'middle').attr('dy', -4)
      .style('font-size', '24px').style('fill', '#f4ede2').style('font-family', 'Archivo Black')
      .text(total);
    g.append('text').attr('text-anchor', 'middle').attr('dy', 14)
      .style('font-size', '9px').style('fill', '#888').style('font-family', 'JetBrains Mono').style('letter-spacing', '0.15em')
      .text('WORKS');

    // Hover
    const tooltip = g.append('g').style('opacity', 0);
    tooltip.append('text').attr('class', 'tt-label').attr('text-anchor', 'middle').attr('dy', -4)
      .style('font-size', '14px').style('fill', '#f4ede2').style('font-family', 'Pretendard');
    tooltip.append('text').attr('class', 'tt-count').attr('text-anchor', 'middle').attr('dy', 14)
      .style('font-size', '11px').style('fill', '#888').style('font-family', 'JetBrains Mono');

    slices.on('mouseover', function(event, d) {
      tooltip.style('opacity', 1);
      tooltip.select('.tt-label').text(d.data[0]);
      tooltip.select('.tt-count').text(d.data[1] + ' (' + Math.round(d.data[1] / total * 100) + '%)');
      g.selectAll('text:not(.tt-label):not(.tt-count)').style('opacity', 0);
      slices.style('opacity', 0.3);
      d3.select(this).style('opacity', 1);
    }).on('mouseout', function() {
      tooltip.style('opacity', 0);
      g.selectAll('text').style('opacity', 1);
      slices.style('opacity', 1);
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${size + 16}, 10)`);
    vizData.langData.slice(0, 8).forEach((d, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
      row.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', color(d[0]));
      row.append('text').attr('x', 16).attr('y', 9).style('font-size', '11px').style('fill', '#a09888').style('font-family', 'Pretendard')
        .text(d[0] + ' (' + d[1] + ')');
    });
  }, [vizData]);

  // Draw treemap
  useEffectR(() => {
    if (!treemapRef.current || !vizData || vizData.composerData.length === 0) return;
    const el = treemapRef.current;
    el.innerHTML = '';

    const w = el.clientWidth, h = 300;
    const root = d3.hierarchy({ children: vizData.composerData.map(([name, count]) => ({ name, count })) })
      .sum(d => d.count);

    d3.treemap().size([w, h]).padding(2).round(true)(root);

    const colors = ['#f57b6b', '#e8c547', '#6bc5f5', '#8be88b', '#d48bf5', '#f5a06b', '#6bf5c5', '#f56b9b', '#b5e86b', '#6b9bf5', '#f5d56b', '#c56bf5'];

    root.leaves().forEach((leaf, i) => {
      const div = document.createElement('div');
      const lw = leaf.x1 - leaf.x0;
      const lh = leaf.y1 - leaf.y0;
      div.style.cssText = `position:absolute;left:${leaf.x0}px;top:${leaf.y0}px;width:${lw}px;height:${lh}px;background:${colors[i % colors.length]};overflow:hidden;border-radius:3px;cursor:pointer;transition:opacity 0.15s;`;
      div.title = leaf.data.name + ': ' + leaf.data.count + ' works';

      if (lw > 50 && lh > 30) {
        const nameEl = document.createElement('div');
        nameEl.textContent = leaf.data.name;
        nameEl.style.cssText = `padding:6px 8px;font-size:${Math.min(Math.max(lw / leaf.data.name.length * 1.2, 9), 16)}px;font-family:Pretendard;font-weight:600;color:#1a1a1a;line-height:1.2;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;`;
        div.appendChild(nameEl);

        if (lh > 48) {
          const countEl = document.createElement('div');
          countEl.textContent = leaf.data.count;
          countEl.style.cssText = 'padding:0 8px;font-size:11px;font-family:JetBrains Mono;color:rgba(0,0,0,0.5);';
          div.appendChild(countEl);
        }
      }

      div.addEventListener('mouseenter', () => {
        el.querySelectorAll('div').forEach(d => { if (d !== div && d.parentNode === el) d.style.opacity = '0.3'; });
      });
      div.addEventListener('mouseleave', () => {
        el.querySelectorAll('div').forEach(d => d.style.opacity = '1');
      });

      el.appendChild(div);
    });
  }, [vizData]);

  if (!vizData || vizData.perfCount === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: vizData.langData.length > 0 ? '1fr 1fr' : '1fr', gap: 40, marginBottom: 40 }}>
        {/* Donut: Language */}
        {vizData.langData.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 16 }}>● REPERTOIRE BY LANGUAGE</div>
            <svg ref={donutRef} width="420" height="220" />
          </div>
        )}
        {/* Heatmap: Activity */}
        <div>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 16 }}>● ACTIVITY</div>
          <div style={{ overflowX: 'auto' }}>
            <svg ref={heatmapRef} />
          </div>
        </div>
      </div>
      {/* Treemap: Composers */}
      {vizData.composerData.length > 0 && (
        <div>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.2em', marginBottom: 16 }}>● COMPOSER MAP</div>
          <div ref={treemapRef} style={{ position: 'relative', width: '100%', height: 300, background: 'var(--bg-deep)', border: '1px solid var(--rule)', borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}

/* ================= PERSON PROFILE PAGE (Singer or Accompanist) ================= */
function getPersonPartners(personId) {
  const person = IX.personById[personId];
  if (!person) return [];
  const isSinger = person.person_role === 'main performer';
  const targetRole = isSinger ? 'accompanist' : 'main performer';

  const parts = IX.partByPerson[personId] || [];
  const perfIds = [...new Set(parts.map(pa => pa.performance_id))];
  const partnerCount = {};

  perfIds.forEach(perfId => {
    const perfParts = IX.partByPerf[perfId] || [];
    const partnerIds = [...new Set(perfParts.map(pa => pa.person_id))];
    partnerIds.forEach(pid => {
      if (pid === personId) return;
      const p = IX.personById[pid];
      if (p && p.person_role === targetRole) {
        partnerCount[pid] = (partnerCount[pid] || 0) + 1;
      }
    });
  });

  return Object.entries(partnerCount)
    .map(([pid, count]) => ({ person: IX.personById[pid], count }))
    .filter(x => x.person)
    .sort((a, b) => b.count - a.count);
}

function SingerProfile({ personId }) {
  const person = IX.personById[personId];
  if (!person) return React.createElement('div', null, 'Person not found');

  const isSinger = person.person_role === 'main performer';
  const performances = getPersonPerformances(personId);
  const topWorks = getPersonWorks(personId).slice(0, 10);
  const topComposers = getPersonComposers(personId).slice(0, 8);
  const partners = getPersonPartners(personId).slice(0, 10);
  const perfCount = performances.length;

  const backLabel = isSinger ? 'SINGERS' : 'NETWORK';
  const backHref = isSinger ? '#/singers' : '#/network';
  const roleLabel = isSinger
    ? (person.person_medium || '').toUpperCase()
    : (person.person_role || '').toUpperCase() + (person.person_medium ? ' · ' + person.person_medium.toUpperCase() : '');
  const partnerLabel = isSinger ? 'ACCOMPANISTS' : 'SINGERS';

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active={isSinger ? 'Singers' : 'Network'} />
      <div style={{ padding: '20px 56px', borderBottom: '1px solid var(--rule)' }}>
        <a href={backHref} className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.15em', textDecoration: 'none' }}>← {backLabel}</a>
      </div>

      <section style={{ padding: '60px 56px 40px' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● {roleLabel}</div>
        <h1 className="display-kr" style={{ fontSize: 96, lineHeight: 0.9, margin: 0, letterSpacing: '-0.03em' }}>{person.person_name}</h1>
        {person.person_isni && (
          <a href={person.person_isni} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.1em', textDecoration: 'none', display: 'inline-block', marginTop: 12, border: '1px solid var(--rule)', padding: '6px 12px' }}>
            ISNI ↗
          </a>
        )}
        <PersonViz personId={personId} />
        <div style={{ display: 'flex', gap: 48, marginTop: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>PERFORMANCES</div>
            <div className="display coral" style={{ fontSize: 56 }}>{perfCount}</div>
          </div>
          {isSinger && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>WORKS PERFORMED</div>
              <div className="display coral" style={{ fontSize: 56 }}>{getPersonWorks(personId).length}</div>
            </div>
          )}
          {isSinger && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>COMPOSERS</div>
              <div className="display coral" style={{ fontSize: 56 }}>{getPersonComposers(personId).length}</div>
            </div>
          )}
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>{partnerLabel}</div>
            <div className="display coral" style={{ fontSize: 56 }}>{partners.length}</div>
          </div>
        </div>
      </section>

      {person.person_profile && (
        <section style={{ padding: '32px 56px', borderTop: '1px solid var(--rule)' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● BIOGRAPHY</div>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.8, maxWidth: 900 }}>{person.person_profile}</p>
        </section>
      )}

      <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: partners.length > 0 ? '1fr 1fr' : '1fr', gap: 64 }}>
        {isSinger && topComposers.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● TOP COMPOSERS</div>
            {topComposers.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--rule)' }}>
                <span className="display" style={{ fontSize: 22 }}>{name.toUpperCase()}</span>
                <span className="mono coral" style={{ fontSize: 13 }}>{count}</span>
              </div>
            ))}
          </div>
        )}
        {isSinger && topWorks.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● MOST PERFORMED WORKS</div>
            {topWorks.map(({ work, count }) => (
              <a key={work.work_id} href={'#/work/' + work.work_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <div style={{ fontSize: 16 }}>{work.mb_title || work.title_variant}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{work.mb_composer || ''}</div>
                </div>
                <span className="mono coral" style={{ fontSize: 13 }}>{count}</span>
              </a>
            ))}
          </div>
        )}
        {partners.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● {isSinger ? 'ACCOMPANIED BY' : 'PERFORMED WITH'}</div>
            {partners.map(({ person: partner, count }) => (
              <a key={partner.person_id} href={'#/person/' + partner.person_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <span className="display-kr" style={{ fontSize: 20 }}>{partner.person_name}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 8 }}>{(partner.person_medium || '').toUpperCase()}</span>
                </div>
                <span className="mono coral" style={{ fontSize: 13 }}>{count}x</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section style={{ padding: '40px 56px 80px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● ALL PERFORMANCES ({perfCount})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
          {performances.map(p => {
            const perfIdNum = p.performance_id.replace('PERF_', '');
            return (
              <a key={p.performance_id} href={'#/detail/' + perfIdNum} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', background: '#000', aspectRatio: '3/4', overflow: 'hidden', marginBottom: 10 }}>
                  <img src={'viewer/data/1024/' + perfIdNum + '.jpg'} alt={p.performance_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{p.performance_date}</div>
                <div className="display-kr" style={{ fontSize: 16, marginTop: 4, lineHeight: 1.3 }}>{p.performance_title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{p.venue_name}</div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ================= SINGERS LIST (enhanced) ================= */
function SingersRDB() {
  const [filter, setFilter] = useStateR('all');
  const [searchQuery, setSearchQuery] = useStateR('');
  const voiceTypes = ['all', 'soprano', 'mezzo-soprano', 'tenor', 'baritone', 'bass'];

  const filtered = useMemoR(() => {
    let list = filter === 'all'
      ? IX.singers
      : IX.singers.filter(s => (s.person_medium || '').toLowerCase().includes(filter));
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.person_name && s.person_name.toLowerCase().includes(q));
    }
    return list;
  }, [filter, searchQuery]);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Singers" />
      <PageHeader kicker="INDEX · PERFORMERS" title="SINGERS" count={String(filtered.length)} sub="한국 독창회 무대에 선 모든 성악가. 이름을 클릭하면 프로필을 볼 수 있습니다." />

      <section style={{ padding: '0 56px 16px', borderBottom: '1px solid var(--rule)' }}>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="성악가 이름 검색..."
          style={{ width: '100%', padding: '14px 20px', fontSize: 16, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none', marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 0 }}>
          {voiceTypes.map(vt => (
            <button key={vt} onClick={() => setFilter(vt)} className="display" style={{ background: filter === vt ? 'var(--coral)' : 'transparent', color: filter === vt ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '16px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {vt === 'all' ? 'ALL' : vt.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 56px 80px' }}>
        {filtered.map((s, i) => (
          <a key={s.person_id} href={'#/singer/' + s.person_id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 160px 80px 40px', gap: 24, padding: '20px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{'№ ' + String(i + 1).padStart(3, '0')}</span>
            <span className="display-kr" style={{ fontSize: 32 }}>{s.person_name}{s.person_isni && <span className="mono" style={{ fontSize: 9, color: 'var(--ink-soft)', marginLeft: 8, verticalAlign: 'middle', border: '1px solid var(--rule)', padding: '2px 6px' }}>ISNI</span>}</span>
            <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.1em' }}>{(s.person_medium || '').toUpperCase()}</span>
            <span className="display" style={{ fontSize: 24, textAlign: 'right' }}>{IX.singerPerfCount[s.person_id] || 0}</span>
            <span className="coral" style={{ fontSize: 18, textAlign: 'right' }}>→</span>
          </a>
        ))}
      </section>
    </div>
  );
}

/* ================= WORK DETAIL PAGE ================= */
function WorkDetail({ workId }) {
  const work = IX.workById[workId];
  if (!work) return React.createElement('div', null, 'Work not found');

  // Find all performances of this work
  const progItems = RDB.programs.filter(pr => pr.work_id === workId);
  const perfIds = [...new Set(progItems.map(pr => pr.performance_id))];
  const performances = perfIds.map(pid => IX.perfById[pid]).filter(Boolean).sort((a, b) => (b.performance_date || '').localeCompare(a.performance_date || ''));

  // Find all singers who performed this work (only from valid performances)
  const validPerfIds = new Set(performances.map(p => p.performance_id));
  const singerCount = {};
  progItems.forEach(pr => {
    if (!validPerfIds.has(pr.performance_id)) return;
    const perfParts = IX.partByPerf[pr.performance_id] || [];
    const uniquePersons = [...new Set(perfParts.map(pa => pa.person_id))];
    uniquePersons.forEach(pid => {
      const person = IX.personById[pid];
      if (person && person.person_role === 'main performer') {
        singerCount[pid] = (singerCount[pid] || 0) + 1;
      }
    });
  });
  const topSingers = Object.entries(singerCount).sort((a, b) => b[1] - a[1]);

  // Sibling works (same parent)
  const siblings = work.mb_parent_work_title
    ? RDB.works.filter(w => w.mb_parent_work_title === work.mb_parent_work_title && w.work_id !== workId)
    : [];

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Repertoire" />
      <div style={{ padding: '20px 56px', borderBottom: '1px solid var(--rule)' }}>
        <a href="#/repertoire" className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.15em', textDecoration: 'none' }}>← REPERTOIRE</a>
      </div>

      <section style={{ padding: '60px 56px 40px' }}>
        {work.mb_parent_work_title && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12, letterSpacing: '0.1em' }}>
            from <span className="coral">{work.mb_parent_work_title}</span>
          </div>
        )}
        <h1 className="display" style={{ fontSize: 64, lineHeight: 0.95, margin: 0, letterSpacing: '-0.02em' }}>{(work.mb_title || work.title_variant || '').toUpperCase()}</h1>
        {work.mbid && (
          <a href={'https://musicbrainz.org/work/' + work.mbid} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.1em', textDecoration: 'none', display: 'inline-block', marginTop: 12, border: '1px solid var(--rule)', padding: '6px 12px' }}>
            MusicBrainz ↗
          </a>
        )}
        <div style={{ display: 'flex', gap: 48, marginTop: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>COMPOSER</div>
            <div className="display coral" style={{ fontSize: 28, marginTop: 4 }}>{(work.mb_composer || 'Unknown').toUpperCase()}</div>
            {work.mb_composer_birth_year && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>{work.mb_composer_birth_year} — {work.mb_composer_death_year || ''}</div>}
          </div>
          {work.mb_language && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>LANGUAGE</div>
              <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{langName(work.mb_language).toUpperCase()}</div>
            </div>
          )}
          {work.mb_type && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>TYPE</div>
              <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{work.mb_type.toUpperCase()}</div>
            </div>
          )}
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>TOTAL PERFORMANCES</div>
            <div className="display coral" style={{ fontSize: 48, marginTop: 4 }}>{performances.length}</div>
          </div>
        </div>
      </section>

      {work.mb_lyricist && (
        <section style={{ padding: '16px 56px', borderTop: '1px solid var(--rule)' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.15em' }}>LYRICIST: </span>
          <span style={{ fontSize: 16 }}>{work.mb_lyricist}</span>
        </section>
      )}

      <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: topSingers.length > 0 && siblings.length > 0 ? '1fr 1fr' : '1fr', gap: 64 }}>
        {topSingers.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● PERFORMED BY</div>
            {topSingers.map(([pid, count]) => {
              const person = IX.personById[pid];
              return (
                <a key={pid} href={'#/singer/' + pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <span className="display-kr" style={{ fontSize: 20 }}>{person.person_name}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{(person.person_medium || '').toUpperCase()}</span>
                  </div>
                  <span className="mono coral" style={{ fontSize: 13 }}>{count}x</span>
                </a>
              );
            })}
          </div>
        )}
        {siblings.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● FROM THE SAME WORK: {work.mb_parent_work_title}</div>
            {siblings.slice(0, 15).map(sw => {
              const swProgCount = RDB.programs.filter(pr => pr.work_id === sw.work_id).length;
              return (
                <a key={sw.work_id} href={'#/work/' + sw.work_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ fontSize: 15 }}>{sw.mb_title || sw.title_variant}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{swProgCount} perf.</span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ padding: '40px 56px 80px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● ALL PERFORMANCES ({performances.length})</div>
        {performances.map(p => (
          <div key={p.performance_id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 240px', gap: 24, padding: '14px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.performance_date}</span>
            <span style={{ fontSize: 15 }}>{p.performance_title}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.venue_name}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ================= REPERTOIRE PAGE (Works + Trends) ================= */
function Repertoire() {
  const [tab, setTab] = useStateR('works');

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Repertoire" />
      <PageHeader kicker="WORKS · TRENDS · LINEAGE" title="REPERTOIRE" count={String(RDB.works.length)} sub="한국 독창회에서 연주된 모든 악곡. 작품 계보와 레퍼토리 트렌드를 탐색하세요." />

      <section style={{ padding: '0 56px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {['works', 'parentWorks', 'trends'].map(t => (
            <button key={t} onClick={() => setTab(t)} className="display" style={{ background: tab === t ? 'var(--coral)' : 'transparent', color: tab === t ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '16px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: '0.1em' }}>
              {t === 'works' ? 'TOP WORKS' : t === 'parentWorks' ? 'OPERAS & CYCLES' : 'TRENDS'}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: '40px 56px 80px' }}>
        {tab === 'works' && <TopWorksTab />}
        {tab === 'parentWorks' && <ParentWorksTab />}
        {tab === 'trends' && <TrendsTab />}
      </section>
    </div>
  );
}

function TopWorksTab() {
  const workPerfCount = useMemoR(() => {
    const counts = {};
    RDB.programs.forEach(pr => {
      if (pr.work_id && pr.is_intermission !== 'TRUE') {
        counts[pr.work_id] = (counts[pr.work_id] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([wid, count]) => ({ work: IX.workById[wid], count })).filter(x => x.work);
  }, []);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● MOST PERFORMED WORKS — TOP 100</div>
      {workPerfCount.map(({ work, count }, i) => (
        <a key={work.work_id} href={'#/work/' + work.work_id} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 240px 80px 60px 30px', gap: 16, padding: '16px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
          <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{i + 1}</span>
          <span style={{ fontSize: 16 }}>{work.mb_title || work.title_variant}</span>
          <span className="display" style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{(work.mb_composer || '').toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{langName(work.mb_language)}</span>
          <span className="display coral" style={{ fontSize: 20, textAlign: 'right' }}>{count}</span>
          <span className="coral" style={{ fontSize: 16, textAlign: 'right' }}>→</span>
        </a>
      ))}
    </div>
  );
}

function ParentWorksTab() {
  const parentGroups = useMemoR(() => {
    const groups = {};
    RDB.works.forEach(w => {
      if (w.mb_parent_work_title) {
        if (!groups[w.mb_parent_work_title]) groups[w.mb_parent_work_title] = { title: w.mb_parent_work_title, composer: w.mb_composer, works: [], totalPerfs: 0 };
        groups[w.mb_parent_work_title].works.push(w);
      }
    });
    // count total performances per parent
    Object.values(groups).forEach(g => {
      g.works.forEach(w => {
        g.totalPerfs += RDB.programs.filter(pr => pr.work_id === w.work_id).length;
      });
    });
    return Object.values(groups).sort((a, b) => b.totalPerfs - a.totalPerfs);
  }, []);

  const [expanded, setExpanded] = useStateR(null);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● OPERAS, SONG CYCLES & COLLECTIONS — {parentGroups.length} PARENT WORKS</div>
      {parentGroups.map(g => (
        <div key={g.title} style={{ borderTop: '1px solid var(--rule)' }}>
          <div onClick={() => setExpanded(expanded === g.title ? null : g.title)} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 80px 80px', gap: 16, padding: '20px 0', alignItems: 'baseline', cursor: 'pointer' }}>
            <span className="display" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>{g.title.toUpperCase()}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{(g.composer || '').toUpperCase()}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{g.works.length} arias</span>
            <span className="display coral" style={{ fontSize: 20, textAlign: 'right' }}>{g.totalPerfs}</span>
          </div>
          {expanded === g.title && (
            <div style={{ paddingLeft: 32, paddingBottom: 16 }}>
              {g.works.map(w => {
                const cnt = RDB.programs.filter(pr => pr.work_id === w.work_id).length;
                return (
                  <a key={w.work_id} href={'#/work/' + w.work_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
                    <span>{w.mb_title || w.title_variant}</span>
                    <span className="mono coral" style={{ fontSize: 12 }}>{cnt}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================= TRENDS TAB (Charts) ================= */
function TrendsTab() {
  const langRef = useRefR(null);
  const voiceRef = useRefR(null);
  const yearlyRef = useRefR(null);

  const data = useMemoR(() => {
    // Per-year stats
    const yearLang = {};
    const yearVoice = {};
    const yearCount = {};

    RDB.programs.forEach(pr => {
      if (pr.is_intermission === 'TRUE' || !pr.work_id) return;
      const perf = IX.perfById[pr.performance_id];
      if (!perf || !perf.performance_date) return;
      const year = perf.performance_date.slice(0, 4);
      const work = IX.workById[pr.work_id];
      if (!work) return;

      if (!yearCount[year]) yearCount[year] = 0;
      yearCount[year]++;

      // language
      const lang = langName(work.mb_language) || 'Unknown';
      if (!yearLang[year]) yearLang[year] = {};
      yearLang[year][lang] = (yearLang[year][lang] || 0) + 1;

      // voice type from main performer
      const parts = IX.partByProgItem[pr.program_item_id] || [];
      parts.forEach(pa => {
        const person = IX.personById[pa.person_id];
        if (person && person.person_role === 'main performer' && person.person_medium) {
          const voice = person.person_medium.toLowerCase();
          if (!yearVoice[year]) yearVoice[year] = {};
          yearVoice[year][voice] = (yearVoice[year][voice] || 0) + 1;
        }
      });
    });

    const years = Object.keys(yearCount).sort();
    const allLangs = [...new Set(Object.values(yearLang).flatMap(Object.keys))].sort();
    const topLangs = allLangs.filter(l => {
      const total = years.reduce((s, y) => s + ((yearLang[y] || {})[l] || 0), 0);
      return total > 30;
    });
    const allVoices = [...new Set(Object.values(yearVoice).flatMap(Object.keys))];

    return { years, yearLang, yearVoice, yearCount, topLangs, allVoices };
  }, []);

  useEffectR(() => {
    if (!data.years.length) return;
    drawLanguageChart(langRef.current, data);
    drawVoiceChart(voiceRef.current, data);
    drawYearlyChart(yearlyRef.current, data);
  }, [data]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 32 }}>● REPERTOIRE TRENDS — 2016-2025</div>

      <div style={{ marginBottom: 64 }}>
        <div className="display" style={{ fontSize: 28, marginBottom: 24 }}>PERFORMANCES BY <span className="coral">YEAR</span></div>
        <svg ref={yearlyRef} style={{ width: '100%', height: 300 }} />
      </div>

      <div style={{ marginBottom: 64 }}>
        <div className="display" style={{ fontSize: 28, marginBottom: 24 }}>LANGUAGE <span className="coral">DISTRIBUTION</span> BY YEAR</div>
        <svg ref={langRef} style={{ width: '100%', height: 400 }} />
      </div>

      <div style={{ marginBottom: 64 }}>
        <div className="display" style={{ fontSize: 28, marginBottom: 24 }}>VOICE TYPE <span className="coral">DISTRIBUTION</span> BY YEAR</div>
        <svg ref={voiceRef} style={{ width: '100%', height: 400 }} />
      </div>
    </div>
  );
}

function drawYearlyChart(svgEl, data) {
  if (!svgEl) return;
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const w = svgEl.clientWidth, h = 300, m = { top: 20, right: 30, bottom: 40, left: 50 };
  const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const x = d3.scaleBand().domain(data.years).range([0, iw]).padding(0.3);
  const y = d3.scaleLinear().domain([0, d3.max(data.years, yr => data.yearCount[yr])]).nice().range([ih, 0]);

  g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.selectAll('.domain, .tick line').style('stroke', '#444');

  g.selectAll('rect').data(data.years).enter().append('rect')
    .attr('x', yr => x(yr)).attr('y', yr => y(data.yearCount[yr])).attr('width', x.bandwidth()).attr('height', yr => ih - y(data.yearCount[yr]))
    .attr('fill', '#f57b6b');

  g.selectAll('.label').data(data.years).enter().append('text')
    .attr('x', yr => x(yr) + x.bandwidth() / 2).attr('y', yr => y(data.yearCount[yr]) - 6)
    .attr('text-anchor', 'middle').style('fill', '#f4ede2').style('font-size', '11px').style('font-family', 'JetBrains Mono')
    .text(yr => data.yearCount[yr]);
}

function drawLanguageChart(svgEl, data) {
  if (!svgEl) return;
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const w = svgEl.clientWidth, h = 400, m = { top: 20, right: 140, bottom: 40, left: 50 };
  const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const stackData = data.years.map(yr => {
    const row = { year: yr };
    data.topLangs.forEach(l => { row[l] = (data.yearLang[yr] || {})[l] || 0; });
    return row;
  });

  const stack = d3.stack().keys(data.topLangs);
  const series = stack(stackData);

  const x = d3.scaleBand().domain(data.years).range([0, iw]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(series, s => d3.max(s, d => d[1]))]).nice().range([ih, 0]);
  const color = d3.scaleOrdinal().domain(data.topLangs).range(['#f57b6b', '#e8c547', '#6bc5f5', '#8be88b', '#d48bf5', '#f5a06b', '#6bf5c5', '#f56b9b']);

  g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.selectAll('.domain, .tick line').style('stroke', '#444');

  g.selectAll('g.layer').data(series).enter().append('g').attr('class', 'layer')
    .attr('fill', d => color(d.key))
    .selectAll('rect').data(d => d).enter().append('rect')
    .attr('x', d => x(d.data.year)).attr('y', d => y(d[1])).attr('width', x.bandwidth()).attr('height', d => y(d[0]) - y(d[1]));

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${w - m.right + 16}, ${m.top})`);
  data.topLangs.forEach((l, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(l));
    row.append('text').attr('x', 18).attr('y', 10).style('fill', '#a09888').style('font-size', '11px').style('font-family', 'JetBrains Mono').text(l);
  });
}

function drawVoiceChart(svgEl, data) {
  if (!svgEl) return;
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const w = svgEl.clientWidth, h = 400, m = { top: 20, right: 160, bottom: 40, left: 50 };
  const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const voices = data.allVoices.filter(v => ['soprano', 'tenor', 'baritone', 'mezzo-soprano', 'bass'].includes(v));
  const stackData = data.years.map(yr => {
    const row = { year: yr };
    voices.forEach(v => { row[v] = (data.yearVoice[yr] || {})[v] || 0; });
    return row;
  });

  const stack = d3.stack().keys(voices);
  const series = stack(stackData);

  const x = d3.scaleBand().domain(data.years).range([0, iw]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(series, s => d3.max(s, d => d[1]))]).nice().range([ih, 0]);
  const color = d3.scaleOrdinal().domain(voices).range(['#f57b6b', '#e8c547', '#6bc5f5', '#d48bf5', '#8be88b']);

  g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').style('fill', '#a09888').style('font-size', '11px');
  g.selectAll('.domain, .tick line').style('stroke', '#444');

  g.selectAll('g.layer').data(series).enter().append('g').attr('class', 'layer')
    .attr('fill', d => color(d.key))
    .selectAll('rect').data(d => d).enter().append('rect')
    .attr('x', d => x(d.data.year)).attr('y', d => y(d[1])).attr('width', x.bandwidth()).attr('height', d => y(d[0]) - y(d[1]));

  const legend = svg.append('g').attr('transform', `translate(${w - m.right + 16}, ${m.top})`);
  voices.forEach((v, i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
    row.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(v));
    row.append('text').attr('x', 18).attr('y', 10).style('fill', '#a09888').style('font-size', '11px').style('font-family', 'JetBrains Mono').text(v);
  });
}

/* ================= NETWORK PAGE ================= */
function Network() {
  const [tab, setTab] = useStateR('accompanists');

  const networkData = useMemoR(() => {
    // Build singer-accompanist pairs from participation table
    const pairCount = {};  // "singerId||accId" -> count of shared performances
    const accPerfs = {};   // accId -> Set of performance_ids
    const accSingers = {}; // accId -> Set of singer_ids

    // Group participations by performance (deduplicated)
    const perfPersons = {};
    RDB.participations.forEach(pa => {
      if (!perfPersons[pa.performance_id]) perfPersons[pa.performance_id] = new Set();
      perfPersons[pa.performance_id].add(pa.person_id);
    });

    // For each performance, find singer-accompanist pairs
    Object.entries(perfPersons).forEach(([perfId, personIdSet]) => {
      const personIds = [...personIdSet];
      const singers = personIds.filter(pid => {
        const p = IX.personById[pid];
        return p && p.person_role === 'main performer';
      });
      const accs = personIds.filter(pid => {
        const p = IX.personById[pid];
        return p && p.person_role === 'accompanist';
      });
      singers.forEach(sid => {
        accs.forEach(aid => {
          const key = sid + '||' + aid;
          pairCount[key] = (pairCount[key] || 0) + 1;
          if (!accPerfs[aid]) accPerfs[aid] = new Set();
          accPerfs[aid].add(perfId);
          if (!accSingers[aid]) accSingers[aid] = new Set();
          accSingers[aid].add(sid);
        });
      });
    });

    // Top pairs
    const topPairs = Object.entries(pairCount)
      .map(([key, count]) => {
        const [sid, aid] = key.split('||');
        return { singer: IX.personById[sid], accompanist: IX.personById[aid], count };
      })
      .filter(x => x.singer && x.accompanist)
      .sort((a, b) => b.count - a.count);

    // Top accompanists
    const topAccompanists = Object.entries(accPerfs)
      .map(([aid, perfs]) => ({
        person: IX.personById[aid],
        perfCount: perfs.size,
        singerCount: (accSingers[aid] || new Set()).size
      }))
      .filter(x => x.person)
      .sort((a, b) => b.perfCount - a.perfCount);

    // Graph data for force layout
    const nodes = [];
    const nodeIndex = {};
    const links = [];

    // Add top accompanists as nodes
    const topAccIds = new Set(topAccompanists.slice(0, 40).map(a => a.person.person_id));
    topAccompanists.slice(0, 40).forEach(a => {
      nodeIndex[a.person.person_id] = nodes.length;
      nodes.push({ id: a.person.person_id, name: a.person.person_name, type: 'accompanist', medium: a.person.person_medium, size: a.perfCount });
    });

    // Add singers connected to these accompanists
    const singerIds = new Set();
    topPairs.forEach(({ singer, accompanist, count }) => {
      if (!topAccIds.has(accompanist.person_id)) return;
      if (count < 2) return;
      singerIds.add(singer.person_id);
    });
    singerIds.forEach(sid => {
      const person = IX.personById[sid];
      if (!person) return;
      nodeIndex[sid] = nodes.length;
      nodes.push({ id: sid, name: person.person_name, type: 'singer', medium: person.person_medium, size: IX.singerPerfCount[sid] || 1 });
    });

    // Add links
    topPairs.forEach(({ singer, accompanist, count }) => {
      const si = nodeIndex[singer.person_id];
      const ai = nodeIndex[accompanist.person_id];
      if (si !== undefined && ai !== undefined) {
        links.push({ source: si, target: ai, value: count });
      }
    });

    return { topPairs, topAccompanists, nodes, links };
  }, []);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Network" />
      <PageHeader kicker="SINGER — ACCOMPANIST CONNECTIONS" title="NETWORK" sub="같은 무대에 선 성악가와 반주자의 관계를 탐색하세요." />

      <section style={{ padding: '0 56px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[['accompanists', 'ACCOMPANISTS'], ['pairs', 'TOP DUOS'], ['bipartite', 'BIPARTITE']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className="display" style={{ background: tab === key ? 'var(--coral)' : 'transparent', color: tab === key ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '16px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: '0.1em' }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: '40px 56px 80px' }}>
        {tab === 'accompanists' && <TopAccompanists accompanists={networkData.topAccompanists} />}
        {tab === 'pairs' && <TopDuos pairs={networkData.topPairs} />}
        {tab === 'bipartite' && <BipartiteGraph data={networkData} />}
      </section>
    </div>
  );
}

/* ---- Network Graph ---- */
function NetworkGraph({ data }) {
  const svgRef = useRefR(null);
  const [hoveredNode, setHoveredNode] = useStateR(null);
  const [hoveredLinks, setHoveredLinks] = useStateR([]);

  useEffectR(() => {
    if (!svgRef.current || !data.nodes.length) return;
    drawNetwork(svgRef.current, data, setHoveredNode, setHoveredLinks);
  }, [data]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f57b6b', display: 'inline-block' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>SINGER</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e8c547', display: 'inline-block' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>ACCOMPANIST</span>
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>— Line thickness = shared performances</span>
      </div>
      {hoveredNode && (
        <div style={{ padding: '16px 24px', marginBottom: 16, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }}>
          <span className="mono coral" style={{ fontSize: 11, letterSpacing: '0.15em' }}>{hoveredNode.type === 'singer' ? 'SINGER' : 'ACCOMPANIST'}: </span>
          <span className="display-kr" style={{ fontSize: 24 }}>{hoveredNode.name}</span>
          {hoveredNode.medium && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{hoveredNode.medium.toUpperCase()}</span>}
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{hoveredNode.size} performances</span>
          {hoveredLinks.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hoveredLinks.map((hl, i) => (
                <span key={i} style={{ padding: '4px 10px', background: 'var(--rule)', fontSize: 12 }}>
                  <span className="display-kr">{hl.name}</span>
                  <span className="mono coral" style={{ marginLeft: 6, fontSize: 11 }}>{hl.count}x</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <svg ref={svgRef} style={{ width: '100%', height: 800, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }} />
    </div>
  );
}

/* ---- Bipartite Graph ---- */
function BipartiteGraph({ data }) {
  const svgRef = useRefR(null);
  const VOICE_COLORS = { soprano: '#f57b6b', 'mezzo-soprano': '#d48bf5', tenor: '#6bc5f5', baritone: '#e8c547', bass: '#8be88b' };

  useEffectR(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const w = svgRef.current.clientWidth, h = 1200;
    const m = { top: 40, right: 200, bottom: 40, left: 200 };

    // Top singers and accompanists
    const topSingers = data.topPairs.reduce((acc, p) => {
      if (!acc.find(x => x.person_id === p.singer.person_id)) acc.push(p.singer);
      return acc;
    }, []).slice(0, 40);
    const topAccs = data.topAccompanists.slice(0, 25).map(a => a.person);

    const singerIds = new Set(topSingers.map(s => s.person_id));
    const accIds = new Set(topAccs.map(a => a.person_id));

    const yS = d3.scalePoint().domain(topSingers.map(s => s.person_id)).range([m.top, h - m.bottom]).padding(0.5);
    const yA = d3.scalePoint().domain(topAccs.map(a => a.person_id)).range([m.top, h - m.bottom]).padding(0.5);

    const g = svg.append('g');

    // Links
    const pairs = data.topPairs.filter(p => singerIds.has(p.singer.person_id) && accIds.has(p.accompanist.person_id));
    const maxCount = d3.max(pairs, p => p.count) || 1;

    const links = g.append('g').selectAll('path').data(pairs).enter().append('path')
      .attr('d', p => {
        const x1 = m.left, y1 = yS(p.singer.person_id);
        const x2 = w - m.right, y2 = yA(p.accompanist.person_id);
        const cx = w / 2;
        return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
      })
      .attr('fill', 'none')
      .attr('stroke', p => VOICE_COLORS[(p.singer.person_medium || '').toLowerCase()] || '#888')
      .attr('stroke-width', p => Math.max(p.count * 1.5, 0.5))
      .attr('stroke-opacity', 0.25);

    // Singer labels (left)
    g.append('g').selectAll('text').data(topSingers).enter().append('text')
      .attr('x', m.left - 8).attr('y', s => yS(s.person_id))
      .attr('text-anchor', 'end').attr('dy', 4)
      .style('font-size', '12px').style('font-family', 'Pretendard')
      .style('fill', s => VOICE_COLORS[(s.person_medium || '').toLowerCase()] || '#ccc')
      .style('cursor', 'pointer')
      .text(s => s.person_name)
      .on('mouseover', function(event, s) {
        links.attr('stroke-opacity', p => p.singer.person_id === s.person_id ? 0.8 : 0.03);
      })
      .on('mouseout', function() { links.attr('stroke-opacity', 0.25); })
      .on('click', function(event, s) { window.location.hash = '#/singer/' + s.person_id; });

    // Singer dots
    g.append('g').selectAll('circle').data(topSingers).enter().append('circle')
      .attr('cx', m.left).attr('cy', s => yS(s.person_id)).attr('r', 4)
      .attr('fill', s => VOICE_COLORS[(s.person_medium || '').toLowerCase()] || '#ccc');

    // Accompanist labels (right)
    g.append('g').selectAll('text').data(topAccs).enter().append('text')
      .attr('x', w - m.right + 8).attr('y', a => yA(a.person_id))
      .attr('text-anchor', 'start').attr('dy', 4)
      .style('font-size', '12px').style('font-family', 'Pretendard')
      .style('fill', '#e8c547')
      .style('cursor', 'pointer')
      .text(a => a.person_name)
      .on('mouseover', function(event, a) {
        links.attr('stroke-opacity', p => p.accompanist.person_id === a.person_id ? 0.8 : 0.03);
      })
      .on('mouseout', function() { links.attr('stroke-opacity', 0.25); })
      .on('click', function(event, a) { window.location.hash = '#/person/' + a.person_id; });

    // Accompanist dots
    g.append('g').selectAll('circle').data(topAccs).enter().append('circle')
      .attr('cx', w - m.right).attr('cy', a => yA(a.person_id)).attr('r', 4)
      .attr('fill', '#e8c547');

    // Column headers
    svg.append('text').attr('x', m.left).attr('y', 20).attr('text-anchor', 'end')
      .style('font-size', '11px').style('font-family', 'JetBrains Mono').style('fill', '#a09888').style('letter-spacing', '0.15em').text('SINGERS');
    svg.append('text').attr('x', w - m.right).attr('y', 20).attr('text-anchor', 'start')
      .style('font-size', '11px').style('font-family', 'JetBrains Mono').style('fill', '#a09888').style('letter-spacing', '0.15em').text('ACCOMPANISTS');

  }, [data]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● BIPARTITE GRAPH — SINGER ↔ ACCOMPANIST</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(VOICE_COLORS).map(([voice, color]) => (
          <span key={voice} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{voice.toUpperCase()}</span>
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e8c547', display: 'inline-block' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>ACCOMPANIST</span>
        </span>
      </div>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 16 }}>이름에 마우스를 올리면 해당 인물의 연결만 강조됩니다. 클릭하면 프로필로 이동합니다.</p>
      <svg ref={svgRef} style={{ width: '100%', height: 1200, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }} />
    </div>
  );
}

/* ---- Adjacency Matrix ---- */
function AdjacencyMatrix({ data }) {
  const svgRef = useRefR(null);
  const VOICE_COLORS = { soprano: '#f57b6b', 'mezzo-soprano': '#d48bf5', tenor: '#6bc5f5', baritone: '#e8c547', bass: '#8be88b' };

  useEffectR(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const topAccs = data.topAccompanists.slice(0, 30).map(a => a.person);
    const topSingers = data.topPairs.reduce((acc, p) => {
      if (!acc.find(x => x.person_id === p.singer.person_id)) acc.push(p.singer);
      return acc;
    }, []).slice(0, 50);

    const pairMap = {};
    data.topPairs.forEach(p => { pairMap[p.singer.person_id + '||' + p.accompanist.person_id] = p.count; });

    const m = { top: 120, right: 30, bottom: 30, left: 140 };
    const cellSize = 18;
    const w = m.left + topAccs.length * cellSize + m.right;
    const h = m.top + topSingers.length * cellSize + m.bottom;

    svg.attr('width', w).attr('height', h).style('height', h + 'px');

    const g = svg.append('g');
    const maxCount = d3.max(data.topPairs, p => p.count) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount]);

    // Cells
    topSingers.forEach((singer, si) => {
      topAccs.forEach((acc, ai) => {
        const count = pairMap[singer.person_id + '||' + acc.person_id] || 0;
        if (count > 0) {
          g.append('rect')
            .attr('x', m.left + ai * cellSize).attr('y', m.top + si * cellSize)
            .attr('width', cellSize - 1).attr('height', cellSize - 1)
            .attr('fill', colorScale(count))
            .attr('rx', 2)
            .append('title').text(singer.person_name + ' × ' + acc.person_name + ': ' + count + ' performances');
        } else {
          g.append('rect')
            .attr('x', m.left + ai * cellSize).attr('y', m.top + si * cellSize)
            .attr('width', cellSize - 1).attr('height', cellSize - 1)
            .attr('fill', '#2a2826').attr('rx', 2);
        }
      });
    });

    // Singer labels (Y axis)
    g.append('g').selectAll('text').data(topSingers).enter().append('text')
      .attr('x', m.left - 6).attr('y', (s, i) => m.top + i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end').attr('dy', 4)
      .style('font-size', '10px').style('font-family', 'Pretendard')
      .style('fill', s => VOICE_COLORS[(s.person_medium || '').toLowerCase()] || '#aaa')
      .text(s => s.person_name);

    // Accompanist labels (X axis, rotated)
    g.append('g').selectAll('text').data(topAccs).enter().append('text')
      .attr('x', 0).attr('y', 0)
      .attr('transform', (a, i) => `translate(${m.left + i * cellSize + cellSize / 2}, ${m.top - 6}) rotate(-60)`)
      .attr('text-anchor', 'start')
      .style('font-size', '10px').style('font-family', 'Pretendard')
      .style('fill', '#e8c547')
      .text(a => a.person_name);

    // Color legend
    const legendW = 200, legendH = 12;
    const legendG = svg.append('g').attr('transform', `translate(${m.left}, ${h - 10})`);
    const legendScale = d3.scaleLinear().domain([0, maxCount]).range([0, legendW]);
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'matrix-grad');
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
      grad.append('stop').attr('offset', t * 100 + '%').attr('stop-color', colorScale(t * maxCount));
    });
    legendG.append('rect').attr('width', legendW).attr('height', legendH).attr('fill', 'url(#matrix-grad)').attr('rx', 3);
    legendG.append('text').attr('x', 0).attr('y', legendH + 14).style('font-size', '9px').style('fill', '#a09888').style('font-family', 'JetBrains Mono').text('0');
    legendG.append('text').attr('x', legendW).attr('y', legendH + 14).attr('text-anchor', 'end').style('font-size', '9px').style('fill', '#a09888').style('font-family', 'JetBrains Mono').text(maxCount + ' perf.');

  }, [data]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● ADJACENCY MATRIX — SINGER × ACCOMPANIST</div>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 16 }}>셀 위에 마우스를 올리면 상세 정보를 볼 수 있습니다. 색이 진할수록 더 많이 함께 공연했습니다.</p>
      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ minWidth: 800, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }} />
      </div>
    </div>
  );
}

/* ---- Partnership Timeline ---- */
function PartnerTimeline({ data }) {
  const svgRef = useRefR(null);
  const VOICE_COLORS = { soprano: '#f57b6b', 'mezzo-soprano': '#d48bf5', tenor: '#6bc5f5', baritone: '#e8c547', bass: '#8be88b' };

  // Build timeline data: for each singer, list performances with accompanist info
  const timelineData = useMemoR(() => {
    // Top singers who have multiple accompanists
    const singers = data.topPairs.reduce((acc, p) => {
      if (!acc.find(x => x.person_id === p.singer.person_id)) acc.push(p.singer);
      return acc;
    }, []).slice(0, 30);

    // For each singer, get all performances with accompanist
    const singerTimelines = singers.map(singer => {
      const parts = IX.partByPerson[singer.person_id] || [];
      const perfIds = [...new Set(parts.map(pa => pa.performance_id))];
      const events = [];

      perfIds.forEach(perfId => {
        const perf = IX.perfById[perfId];
        if (!perf || !perf.performance_date) return;
        const perfParts = IX.partByPerf[perfId] || [];
        const accIds = [...new Set(perfParts.map(pa => pa.person_id))].filter(pid => {
          const p = IX.personById[pid];
          return p && p.person_role === 'accompanist';
        });
        accIds.forEach(aid => {
          events.push({ date: perf.performance_date, accId: aid, accName: IX.personById[aid].person_name });
        });
      });

      events.sort((a, b) => a.date.localeCompare(b.date));
      return { singer, events };
    }).filter(s => s.events.length >= 2);

    // Collect all unique accompanists for coloring
    const allAccNames = [...new Set(singerTimelines.flatMap(s => s.events.map(e => e.accName)))];

    return { singerTimelines, allAccNames };
  }, [data]);

  useEffectR(() => {
    if (!svgRef.current || !timelineData.singerTimelines.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const tl = timelineData.singerTimelines;
    const rowH = 28;
    const m = { top: 40, right: 30, bottom: 30, left: 160 };
    const w = svgRef.current.clientWidth;
    const h = m.top + tl.length * rowH + m.bottom;
    svg.style('height', h + 'px');

    // Time scale
    const allDates = tl.flatMap(s => s.events.map(e => new Date(e.date)));
    const x = d3.scaleTime().domain(d3.extent(allDates)).range([m.left, w - m.right]);

    // Top 15 accompanists get distinct colors, rest gray
    const topAccCounts = {};
    tl.forEach(s => s.events.forEach(e => { topAccCounts[e.accName] = (topAccCounts[e.accName] || 0) + 1; }));
    const topAccNames = Object.entries(topAccCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(x => x[0]);
    const accColor = d3.scaleOrdinal().domain(topAccNames).range([
      '#f57b6b', '#e8c547', '#6bc5f5', '#8be88b', '#d48bf5', '#f5a06b', '#6bf5c5', '#f56b9b',
      '#b5e86b', '#6b9bf5', '#f5d56b', '#c56bf5', '#6bf59b', '#f56bd4', '#9bf56b'
    ]);

    const g = svg.append('g');

    // Year gridlines
    const years = d3.timeYear.range(d3.extent(allDates)[0], d3.extent(allDates)[1]);
    years.forEach(yr => {
      g.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', m.top).attr('y2', h - m.bottom)
        .style('stroke', '#333').style('stroke-dasharray', '2,4');
      g.append('text').attr('x', x(yr)).attr('y', m.top - 8).attr('text-anchor', 'middle')
        .style('font-size', '10px').style('fill', '#666').style('font-family', 'JetBrains Mono')
        .text(yr.getFullYear());
    });

    // Rows
    tl.forEach((s, i) => {
      const y = m.top + i * rowH;

      // Singer label
      g.append('text').attr('x', m.left - 8).attr('y', y + rowH / 2).attr('dy', 4).attr('text-anchor', 'end')
        .style('font-size', '11px').style('font-family', 'Pretendard')
        .style('fill', VOICE_COLORS[(s.singer.person_medium || '').toLowerCase()] || '#aaa')
        .style('cursor', 'pointer')
        .text(s.singer.person_name)
        .on('click', function() { window.location.hash = '#/singer/' + s.singer.person_id; });

      // Horizontal guide
      g.append('line').attr('x1', m.left).attr('x2', w - m.right).attr('y1', y + rowH / 2).attr('y2', y + rowH / 2)
        .style('stroke', '#2a2826');

      // Performance dots
      s.events.forEach(e => {
        const cx = x(new Date(e.date));
        const color = topAccNames.includes(e.accName) ? accColor(e.accName) : '#555';
        g.append('circle').attr('cx', cx).attr('cy', y + rowH / 2).attr('r', 4)
          .attr('fill', color).attr('fill-opacity', 0.8)
          .style('cursor', 'pointer')
          .append('title').text(e.date + ' — ' + e.accName);
      });
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${m.left}, ${h - 10})`);
    topAccNames.slice(0, 10).forEach((name, i) => {
      const lx = i * 130;
      legend.append('circle').attr('cx', lx).attr('cy', 0).attr('r', 5).attr('fill', accColor(name));
      legend.append('text').attr('x', lx + 10).attr('y', 4)
        .style('font-size', '10px').style('fill', '#a09888').style('font-family', 'Pretendard').text(name);
    });

  }, [timelineData]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● PARTNERSHIP TIMELINE — WHO ACCOMPANIED WHOM, WHEN</div>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 16 }}>각 점은 하나의 공연입니다. 색상은 반주자를 나타냅니다. 점 위에 마우스를 올리면 반주자 이름과 날짜가 표시됩니다.</p>
      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ width: '100%', minWidth: 900, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }} />
      </div>
    </div>
  );
}

/* ---- Top Duos ---- */
function TopDuos({ pairs }) {
  const [visibleCount, setVisibleCount] = useStateR(30);
  const sentinelRef = useRefR(null);
  useEffectR(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < pairs.length) setVisibleCount(c => Math.min(c + 30, pairs.length));
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [visibleCount, pairs.length]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● SINGER — ACCOMPANIST TOP DUOS · {pairs.length} TOTAL</div>
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 40px 1fr 100px 80px', gap: 16, padding: '12px 0', borderBottom: '2px solid var(--rule)', alignItems: 'baseline' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>RANK</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>SINGER</span>
        <span />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>ACCOMPANIST</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>INSTRUMENT</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', textAlign: 'right' }}>TOGETHER</span>
      </div>
      {pairs.slice(0, visibleCount).map(({ singer, accompanist, count }, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 40px 1fr 100px 80px', gap: 16, padding: '18px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline' }}>
          <span className="display coral" style={{ fontSize: 20 }}>{i + 1}</span>
          <a href={'#/singer/' + singer.person_id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="display-kr" style={{ fontSize: 22 }}>{singer.person_name}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 8 }}>{(singer.person_medium || '').toUpperCase()}</span>
          </a>
          <span className="coral" style={{ fontSize: 14, textAlign: 'center' }}>&amp;</span>
          <a href={'#/person/' + accompanist.person_id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="display-kr" style={{ fontSize: 22 }}>{accompanist.person_name}</span>
          </a>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{(accompanist.person_medium || '').toUpperCase()}</span>
          <div style={{ textAlign: 'right' }}>
            <span className="display coral" style={{ fontSize: 28 }}>{count}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', display: 'block' }}>performances</span>
          </div>
        </div>
      ))}
      {visibleCount < pairs.length && <div ref={sentinelRef} style={{ height: 40 }} />}
    </div>
  );
}

/* ---- Top Accompanists ---- */
function TopAccompanists({ accompanists }) {
  const [mediumFilter, setMediumFilter] = useStateR('all');
  const [searchQuery, setSearchQuery] = useStateR('');

  const mediumTypes = useMemoR(() => {
    const counts = {};
    accompanists.forEach(a => {
      const m = (a.person.person_medium || '').toLowerCase();
      if (m) counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 2).map(([m]) => m);
  }, [accompanists]);

  const filtered = useMemoR(() => {
    let list = accompanists;
    if (mediumFilter !== 'all') list = list.filter(a => (a.person.person_medium || '').toLowerCase() === mediumFilter);
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.person.person_name && a.person.person_name.toLowerCase().includes(q));
    }
    return list;
  }, [accompanists, mediumFilter, searchQuery]);

  const [visibleCount, setVisibleCount] = useStateR(30);
  const sentinelRef = useRefR(null);
  useEffectR(() => { setVisibleCount(30); }, [mediumFilter, searchQuery]);
  useEffectR(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filtered.length) setVisibleCount(c => Math.min(c + 30, filtered.length));
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  return (
    <div>
      <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● ACCOMPANIST RANKINGS — {filtered.length} / {accompanists.length} TOTAL</div>

      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        placeholder="반주자 이름 검색..."
        style={{ width: '100%', padding: '12px 18px', fontSize: 15, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none', marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => setMediumFilter('all')} className="mono" style={{ background: mediumFilter === 'all' ? 'var(--coral)' : 'transparent', color: mediumFilter === 'all' ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '10px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>ALL</button>
        {mediumTypes.map(m => (
          <button key={m} onClick={() => setMediumFilter(m)} className="mono" style={{ background: mediumFilter === m ? 'var(--coral)' : 'transparent', color: mediumFilter === m ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '10px 12px', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {m}
          </button>
        ))}
      </div>

      {filtered.slice(0, visibleCount).map((a, i) => (
        <div key={a.person.person_id} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 120px 120px 120px', gap: 16, padding: '20px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline' }}>
          <span className="display coral" style={{ fontSize: 24 }}>{i + 1}</span>
          <a href={'#/person/' + a.person.person_id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="display-kr" style={{ fontSize: 28 }}>{a.person.person_name}</span>
            {a.person.person_profile && (
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.5, maxWidth: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {a.person.person_profile}
              </div>
            )}
          </a>
          <div style={{ textAlign: 'center' }}>
            <div className="display coral" style={{ fontSize: 32 }}>{a.perfCount}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>PERFORMANCES</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="display" style={{ fontSize: 32 }}>{a.singerCount}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>SINGERS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{(a.person.person_medium || '').toUpperCase()}</span>
          </div>
        </div>
      ))}
      {visibleCount < accompanists.length && <div ref={sentinelRef} style={{ height: 40 }} />}
    </div>
  );
}

/* ---- Draw Network ---- */
function drawNetwork(svgEl, graphData, setHoveredNode, setHoveredLinks) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const w = svgEl.clientWidth, h = 800;

  const simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.links).id((d, i) => i).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(w / 2, h / 2))
    .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.size) * 2.5 + 10));

  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.2, 5]).on('zoom', (event) => {
    g.attr('transform', event.transform);
  }));

  const link = g.append('g').selectAll('line').data(graphData.links).enter().append('line')
    .style('stroke', '#666').style('stroke-opacity', 0.3)
    .style('stroke-width', d => Math.min(d.value * 1.5, 8));

  const node = g.append('g').selectAll('circle').data(graphData.nodes).enter().append('circle')
    .attr('r', d => Math.max(Math.sqrt(d.size) * 2.5, 5))
    .attr('fill', d => d.type === 'singer' ? '#f57b6b' : '#e8c547')
    .attr('stroke', d => d.type === 'singer' ? '#d4594e' : '#c4a52f')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const connected = graphData.links
        .filter(l => l.source === d || l.target === d)
        .map(l => {
          const other = l.source === d ? l.target : l.source;
          return { name: other.name, count: l.value };
        })
        .sort((a, b) => b.count - a.count);
      setHoveredNode(d);
      setHoveredLinks(connected);
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 3);
      link.style('stroke-opacity', l => (l.source === d || l.target === d) ? 0.9 : 0.03)
        .style('stroke', l => (l.source === d || l.target === d) ? '#f57b6b' : '#666');
      node.style('opacity', n => {
        if (n === d) return 1;
        return graphData.links.some(l => (l.source === d && l.target === n) || (l.target === d && l.source === n)) ? 1 : 0.08;
      });
      label.style('opacity', n => {
        if (n === d) return 1;
        return graphData.links.some(l => (l.source === d && l.target === n) || (l.target === d && l.source === n)) ? 1 : 0.05;
      });
    })
    .on('mouseout', function() {
      setHoveredNode(null);
      setHoveredLinks([]);
      d3.select(this).attr('stroke', d => d.type === 'singer' ? '#d4594e' : '#c4a52f').attr('stroke-width', 1);
      link.style('stroke-opacity', 0.3).style('stroke', '#666');
      node.style('opacity', 1);
      label.style('opacity', 1);
    })
    .on('click', function(event, d) {
      if (d.type === 'singer') window.location.hash = '#/singer/' + d.id;
    })
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  const label = g.append('g').selectAll('text').data(graphData.nodes).enter().append('text')
    .text(d => d.name)
    .style('font-size', d => d.type === 'accompanist' ? '11px' : '9px')
    .style('font-weight', d => d.type === 'accompanist' ? '600' : '400')
    .style('fill', d => d.type === 'accompanist' ? '#f0d870' : '#e8c0b8')
    .style('font-family', 'Pretendard')
    .style('pointer-events', 'none')
    .attr('dx', d => Math.max(Math.sqrt(d.size) * 2.5, 5) + 4)
    .attr('dy', 3);

  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    label.attr('x', d => d.x).attr('y', d => d.y);
  });
}

/* ================= DETAIL PROGRAMME (RDB-powered) ================= */
function DetailProgramme({ perfId }) {
  const fullPerfId = 'PERF_' + perfId;
  const progs = (IX.progByPerf[fullPerfId] || []).sort((a, b) => (a.program_order || 0) - (b.program_order || 0));

  // Get participants for this performance
  const parts = IX.partByPerf[fullPerfId] || [];
  const personIds = [...new Set(parts.map(pa => pa.person_id))];
  const singers = personIds.map(pid => IX.personById[pid]).filter(p => p && p.person_role === 'main performer');
  const accompanists = personIds.map(pid => IX.personById[pid]).filter(p => p && p.person_role === 'accompanist');

  if (progs.length === 0 && singers.length === 0) return null;

  // Group program items by composer
  const groups = [];
  let currentComposer = null;
  progs.forEach(pr => {
    if (pr.is_intermission === 'TRUE') {
      groups.push({ type: 'intermission' });
      currentComposer = null;
      return;
    }
    const work = pr.work_id ? IX.workById[pr.work_id] : null;
    const composer = work ? (work.mb_composer || 'Unknown') : 'Unknown';
    if (composer !== currentComposer) {
      const birthYear = work ? work.mb_composer_birth_year : null;
      const deathYear = work ? work.mb_composer_death_year : null;
      groups.push({ type: 'composer', name: composer, birthYear, deathYear, works: [] });
      currentComposer = composer;
    }
    if (work) {
      groups[groups.length - 1].works.push(work);
    }
  });

  return (
    <div>
      {/* Participants */}
      <section style={{ padding: '0 56px 40px', display: 'grid', gridTemplateColumns: accompanists.length > 0 ? '1fr 1fr' : '1fr', gap: 48 }}>
        {singers.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● SINGER</div>
            {singers.map(s => (
              <div key={s.person_id} style={{ marginBottom: 16 }}>
                <a href={'#/singer/' + s.person_id} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <span className="display-kr" style={{ fontSize: 32 }}>{s.person_name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{(s.person_medium || '').toUpperCase()}</span>
                </a>
                {s.person_profile && (
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, marginTop: 8, maxWidth: 600 }}>{s.person_profile}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {accompanists.length > 0 && (
          <div>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● ACCOMPANIST</div>
            {accompanists.map(a => (
              <a key={a.person_id} href={'#/person/' + a.person_id} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 8 }}>
                <span className="display-kr" style={{ fontSize: 32 }}>{a.person_name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{(a.person_medium || '').toUpperCase()}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Programme */}
      {groups.length > 0 && (
        <section style={{ padding: '40px 56px 40px', borderTop: '1px solid var(--rule)' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● PROGRAMME</div>
          {groups.map((g, gi) => {
            if (g.type === 'intermission') {
              return (
                <div key={'int-' + gi} style={{ padding: '16px 0', textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>— INTERMISSION —</span>
                </div>
              );
            }
            return (
              <div key={gi} style={{ marginBottom: 28 }}>
                <div style={{ padding: '12px 0', borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span className="display" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{g.name.toUpperCase()}</span>
                  {g.birthYear && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>({g.birthYear}–{g.deathYear || ''})</span>
                  )}
                </div>
                {g.works.map((w, wi) => (
                  <a key={wi} href={'#/work/' + w.work_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 8px 24px', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 15 }}>{w.mb_title || w.title_variant}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{langName(w.mb_language)}</span>
                  </a>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ================= COMPOSER DETAIL ================= */
function ComposerDetail({ composerName }) {
  const name = decodeURIComponent(composerName);
  const yearChartRef = useRefR(null);

  const data = useMemoR(() => {
    // All works by this composer
    const works = RDB.works.filter(w => w.mb_composer === name);
    const birthYear = works.find(w => w.mb_composer_birth_year)?.mb_composer_birth_year || null;
    const deathYear = works.find(w => w.mb_composer_death_year)?.mb_composer_death_year || null;

    // Work performance counts
    const workIds = new Set(works.map(w => w.work_id));
    const workPerfCount = {};
    const perfIds = new Set();
    const yearCount = {};

    RDB.programs.forEach(pr => {
      if (!workIds.has(pr.work_id) || pr.is_intermission === 'TRUE') return;
      perfIds.add(pr.performance_id);
      workPerfCount[pr.work_id] = (workPerfCount[pr.work_id] || 0) + 1;
      const perf = IX.perfById[pr.performance_id];
      if (perf && perf.performance_date) {
        const year = perf.performance_date.slice(0, 4);
        yearCount[year] = (yearCount[year] || 0) + 1;
      }
    });

    // Top works
    const topWorks = works
      .map(w => ({ work: w, count: workPerfCount[w.work_id] || 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    // Top singers who performed this composer
    const singerCount = {};
    RDB.programs.forEach(pr => {
      if (!workIds.has(pr.work_id) || pr.is_intermission === 'TRUE') return;
      const parts = IX.partByProgItem[pr.program_item_id] || [];
      parts.forEach(pa => {
        const person = IX.personById[pa.person_id];
        if (person && person.person_role === 'main performer') {
          singerCount[pa.person_id] = (singerCount[pa.person_id] || 0) + 1;
        }
      });
    });
    const topSingers = Object.entries(singerCount)
      .map(([pid, count]) => ({ person: IX.personById[pid], count }))
      .filter(x => x.person)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Language distribution
    const langCount = {};
    works.forEach(w => {
      if (w.mb_language && workPerfCount[w.work_id]) {
        const lang = langName(w.mb_language) || w.mb_language;
        langCount[lang] = (langCount[lang] || 0) + (workPerfCount[w.work_id] || 0);
      }
    });
    const languages = Object.entries(langCount).sort((a, b) => b[1] - a[1]);

    // Voice type distribution
    const voiceCount = {};
    RDB.programs.forEach(pr => {
      if (!workIds.has(pr.work_id) || pr.is_intermission === 'TRUE') return;
      const parts = IX.partByProgItem[pr.program_item_id] || [];
      parts.forEach(pa => {
        const person = IX.personById[pa.person_id];
        if (person && person.person_role === 'main performer' && person.person_medium) {
          voiceCount[person.person_medium] = (voiceCount[person.person_medium] || 0) + 1;
        }
      });
    });
    const voices = Object.entries(voiceCount).sort((a, b) => b[1] - a[1]);

    // Parent works (operas, cycles)
    const parentGroups = {};
    works.forEach(w => {
      if (w.mb_parent_work_title) {
        if (!parentGroups[w.mb_parent_work_title]) parentGroups[w.mb_parent_work_title] = { works: [], totalPerfs: 0 };
        parentGroups[w.mb_parent_work_title].works.push(w);
        parentGroups[w.mb_parent_work_title].totalPerfs += (workPerfCount[w.work_id] || 0);
      }
    });
    const parentWorks = Object.entries(parentGroups)
      .map(([title, g]) => ({ title, ...g }))
      .filter(g => g.totalPerfs > 0)
      .sort((a, b) => b.totalPerfs - a.totalPerfs);

    // Performances list
    const performances = [...perfIds]
      .map(pid => IX.perfById[pid])
      .filter(Boolean)
      .sort((a, b) => (b.performance_date || '').localeCompare(a.performance_date || ''));

    return { works, birthYear, deathYear, topWorks, topSingers, languages, voices, parentWorks, performances, yearCount, totalPerfs: perfIds.size, totalWorks: topWorks.length };
  }, [name]);

  // Year chart
  useEffectR(() => {
    if (!yearChartRef.current || Object.keys(data.yearCount).length === 0) return;
    const svg = d3.select(yearChartRef.current);
    svg.selectAll('*').remove();
    const years = Object.keys(data.yearCount).sort();
    const w = yearChartRef.current.clientWidth, h = 200;
    const m = { top: 16, right: 16, bottom: 30, left: 36 };
    const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = d3.scaleBand().domain(years).range([0, iw]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(years, yr => data.yearCount[yr])]).nice().range([ih, 0]);
    g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x)).selectAll('text').style('fill', '#a09888').style('font-size', '10px');
    g.append('g').call(d3.axisLeft(y).ticks(4)).selectAll('text').style('fill', '#a09888').style('font-size', '10px');
    g.selectAll('.domain, .tick line').style('stroke', '#444');
    g.selectAll('rect').data(years).enter().append('rect')
      .attr('x', yr => x(yr)).attr('y', yr => y(data.yearCount[yr])).attr('width', x.bandwidth()).attr('height', yr => ih - y(data.yearCount[yr]))
      .attr('fill', '#f57b6b');
    g.selectAll('.label').data(years).enter().append('text')
      .attr('x', yr => x(yr) + x.bandwidth() / 2).attr('y', yr => y(data.yearCount[yr]) - 4)
      .attr('text-anchor', 'middle').style('fill', '#f4ede2').style('font-size', '9px').style('font-family', 'JetBrains Mono')
      .text(yr => data.yearCount[yr]);
  }, [data]);

  const VOICE_COLORS = { soprano: '#f57b6b', 'mezzo-soprano': '#d48bf5', tenor: '#6bc5f5', baritone: '#e8c547', bass: '#8be88b' };

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Composers" />
      <div style={{ padding: '20px 56px', borderBottom: '1px solid var(--rule)' }}>
        <a href="#/composers" className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '0.15em', textDecoration: 'none' }}>← COMPOSERS</a>
      </div>

      <section style={{ padding: '60px 56px 40px' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● COMPOSER</div>
        <h1 className="display" style={{ fontSize: 80, lineHeight: 0.9, margin: 0, letterSpacing: '-0.03em' }}>{name.toUpperCase()}</h1>
        {data.birthYear && (
          <div className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>{data.birthYear} — {data.deathYear || 'present'}</div>
        )}
        <div style={{ display: 'flex', gap: 48, marginTop: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>PERFORMANCES</div>
            <div className="display coral" style={{ fontSize: 56 }}>{data.totalPerfs}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>WORKS PERFORMED</div>
            <div className="display coral" style={{ fontSize: 56 }}>{data.totalWorks}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.2em' }}>SINGERS</div>
            <div className="display coral" style={{ fontSize: 56 }}>{data.topSingers.length}</div>
          </div>
        </div>
      </section>

      {/* Year trend */}
      <section style={{ padding: '32px 56px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● YEARLY TREND</div>
        <svg ref={yearChartRef} style={{ width: '100%', height: 200 }} />
      </section>

      {/* Stats row: languages + voice types */}
      <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
        <div>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● LANGUAGE DISTRIBUTION</div>
          {data.languages.map(([lang, count]) => (
            <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 12 }}>{lang}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{count}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: (count / data.languages[0][1] * 100) + '%', background: 'var(--coral)', borderRadius: 3 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● VOICE TYPE DISTRIBUTION</div>
          {data.voices.map(([voice, count]) => (
            <div key={voice} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: VOICE_COLORS[voice] || '#888', display: 'inline-block' }} />
                    <span className="mono" style={{ fontSize: 12 }}>{voice.toUpperCase()}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{count}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: (count / data.voices[0][1] * 100) + '%', background: VOICE_COLORS[voice] || '#888', borderRadius: 3 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top singers */}
      <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● TOP SINGERS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {data.topSingers.map(({ person, count }) => (
            <a key={person.person_id} href={'#/singer/' + person.person_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <span className="display-kr" style={{ fontSize: 20 }}>{person.person_name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 8 }}>{(person.person_medium || '').toUpperCase()}</span>
              </div>
              <span className="mono coral" style={{ fontSize: 13 }}>{count}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Parent works */}
      {data.parentWorks.length > 0 && (
        <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)' }}>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● OPERAS & SONG CYCLES</div>
          {data.parentWorks.map(g => (
            <div key={g.title} style={{ marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span className="display" style={{ fontSize: 22 }}>{g.title.toUpperCase()}</span>
                <span className="mono coral" style={{ fontSize: 12 }}>{g.totalPerfs} perf. · {g.works.length} works</span>
              </div>
              <div style={{ paddingLeft: 20, borderLeft: '2px solid var(--rule)' }}>
                {g.works.map(w => (
                  <a key={w.work_id} href={'#/work/' + w.work_id} style={{ display: 'block', padding: '4px 0', fontSize: 14, textDecoration: 'none', color: 'var(--ink-soft)' }}>
                    {w.mb_title || w.title_variant}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Top works */}
      <section style={{ padding: '40px 56px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● ALL WORKS ({data.topWorks.length})</div>
        {data.topWorks.map(({ work, count }, i) => (
          <a key={work.work_id} href={'#/work/' + work.work_id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 60px', gap: 16, padding: '12px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{i + 1}</span>
            <span style={{ fontSize: 15 }}>{work.mb_title || work.title_variant}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{langName(work.mb_language)}</span>
            <span className="display coral" style={{ fontSize: 18, textAlign: 'right' }}>{count}</span>
          </a>
        ))}
      </section>

      {/* Recent performances with posters */}
      <section style={{ padding: '40px 56px 80px', borderTop: '1px solid var(--rule)' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 24 }}>● PERFORMANCES ({data.performances.length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
          {data.performances.slice(0, 24).map(p => {
            const perfIdNum = p.performance_id.replace('PERF_', '');
            return (
              <a key={p.performance_id} href={'#/detail/' + perfIdNum} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', background: '#000', aspectRatio: '3/4', overflow: 'hidden', marginBottom: 8 }}>
                  <img src={'viewer/data/1024/' + perfIdNum + '.jpg'} alt={p.performance_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.performance_date}</div>
                <div className="display-kr" style={{ fontSize: 14, marginTop: 2, lineHeight: 1.3 }}>{p.performance_title}</div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ================= REVIEW SECTION ================= */
function ReviewSection({ perfId }) {
  const fullPerfId = 'PERF_' + perfId;
  const storageKey = 'kovox_reviews_' + perfId;

  const [reviews, setReviews] = useStateR(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const [isWriting, setIsWriting] = useStateR(false);
  const [authorName, setAuthorName] = useStateR('');
  const [reviewText, setReviewText] = useStateR('');
  const [taggedWorks, setTaggedWorks] = useStateR([]);  // [{work_id, title}]
  const [showWorkPicker, setShowWorkPicker] = useStateR(false);

  // Get program works for this performance
  const programWorks = useMemoR(() => {
    const progs = (IX.progByPerf[fullPerfId] || [])
      .filter(pr => pr.work_id && pr.is_intermission !== 'TRUE')
      .sort((a, b) => (a.program_order || 0) - (b.program_order || 0));
    return progs.map(pr => {
      const work = IX.workById[pr.work_id];
      if (!work) return null;
      return { work_id: pr.work_id, title: work.mb_title || work.title_variant || '', composer: work.mb_composer || '' };
    }).filter(Boolean);
  }, [fullPerfId]);

  function toggleWork(w) {
    setTaggedWorks(prev => {
      if (prev.find(x => x.work_id === w.work_id)) {
        return prev.filter(x => x.work_id !== w.work_id);
      }
      return [...prev, w];
    });
  }

  function submitReview() {
    if (!reviewText.trim()) return;
    const newReview = {
      id: Date.now(),
      author: authorName.trim() || 'Anonymous',
      text: reviewText.trim(),
      works: taggedWorks,
      date: new Date().toISOString().slice(0, 10)
    };
    const updated = [newReview, ...reviews];
    setReviews(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setReviewText('');
    setTaggedWorks([]);
    setAuthorName('');
    setIsWriting(false);
    setShowWorkPicker(false);
  }

  function deleteReview(id) {
    const updated = reviews.filter(r => r.id !== id);
    setReviews(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  return (
    <section style={{ padding: '40px 56px 80px', borderTop: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <div>
          <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em' }}>● REVIEWS</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>{reviews.length}개의 후기</div>
        </div>
        {!isWriting && (
          <button onClick={() => setIsWriting(true)} className="kv2-btn" style={{ padding: '12px 24px', fontSize: 13, border: 'none', cursor: 'pointer' }}>
            후기 작성하기
          </button>
        )}
      </div>

      {/* Write review form */}
      {isWriting && (
        <div style={{ marginBottom: 32, padding: 24, background: 'var(--bg-deep)', border: '1px solid var(--rule)' }}>
          <div className="mono coral" style={{ fontSize: 11, letterSpacing: '0.15em', marginBottom: 16 }}>● 후기 작성</div>

          <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)}
            placeholder="이름 (선택)"
            style={{ width: '100%', padding: '12px 16px', fontSize: 14, background: '#1f1d1b', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none', marginBottom: 12 }} />

          {/* Tagged works */}
          {taggedWorks.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {taggedWorks.map(w => (
                <span key={w.work_id} onClick={() => toggleWork(w)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--coral)', color: 'var(--bg-deep)', fontSize: 12, fontFamily: 'Pretendard', cursor: 'pointer', borderRadius: 2 }}>
                  {w.title} <span style={{ fontWeight: 700 }}>×</span>
                </span>
              ))}
            </div>
          )}

          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
            placeholder="공연에 대한 감상을 자유롭게 작성하세요..."
            rows="5"
            style={{ width: '100%', padding: '12px 16px', fontSize: 15, background: '#1f1d1b', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />

          {/* Work picker */}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowWorkPicker(!showWorkPicker)} className="mono" style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-soft)', padding: '8px 16px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
              {showWorkPicker ? '▲ 곡 선택 닫기' : '♪ 프로그램에서 곡 태그하기'}
            </button>
          </div>

          {showWorkPicker && programWorks.length > 0 && (
            <div style={{ marginTop: 12, padding: 16, background: '#1f1d1b', border: '1px solid var(--rule)', maxHeight: 300, overflowY: 'auto' }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginBottom: 10, letterSpacing: '0.15em' }}>곡을 클릭하면 후기에 태그됩니다</div>
              {programWorks.map(w => {
                const isSelected = taggedWorks.some(x => x.work_id === w.work_id);
                return (
                  <div key={w.work_id} onClick={() => toggleWork(w)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 12px', cursor: 'pointer', background: isSelected ? 'rgba(245, 123, 107, 0.15)' : 'transparent', borderLeft: isSelected ? '3px solid var(--coral)' : '3px solid transparent', marginBottom: 2 }}>
                    <div>
                      <span style={{ fontSize: 14, color: isSelected ? 'var(--ink)' : 'var(--ink-soft)' }}>{w.title}</span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 8 }}>{w.composer}</span>
                    </div>
                    {isSelected && <span className="coral" style={{ fontSize: 12 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => { setIsWriting(false); setShowWorkPicker(false); setTaggedWorks([]); setReviewText(''); }} className="mono" style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-soft)', padding: '10px 20px', fontSize: 12, cursor: 'pointer' }}>
              취소
            </button>
            <button onClick={submitReview} className="kv2-btn" style={{ padding: '10px 24px', fontSize: 13, border: 'none', cursor: 'pointer', opacity: reviewText.trim() ? 1 : 0.4 }}>
              등록
            </button>
          </div>
        </div>
      )}

      {/* Review list */}
      {reviews.length > 0 && (
        <div>
          {reviews.map(r => (
            <div key={r.id} style={{ padding: '24px 0', borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <span className="display-kr" style={{ fontSize: 18 }}>{r.author}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{r.date}</span>
                </div>
                <button onClick={() => deleteReview(r.id)} className="mono" style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 10, cursor: 'pointer' }}>삭제</button>
              </div>

              {r.works && r.works.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.works.map((w, wi) => (
                    <a key={wi} href={'#/work/' + w.work_id} style={{ display: 'inline-block', padding: '3px 8px', background: 'var(--bg-deep)', border: '1px solid var(--rule)', fontSize: 11, color: 'var(--coral)', textDecoration: 'none', fontFamily: 'Pretendard' }}>
                      ♪ {w.title}
                    </a>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 && !isWriting && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>아직 후기가 없습니다</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 8 }}>이 공연에 대한 첫 번째 후기를 남겨보세요</div>
        </div>
      )}
    </section>
  );
}

/* ================= PERFORMANCES LIST ================= */
function PerformancesList() {
  const [sortBy, setSortBy] = useStateR('date-desc');
  const [yearFilter, setYearFilter] = useStateR('all');
  const [venueFilter, setVenueFilter] = useStateR('all');
  const [searchQuery, setSearchQuery] = useStateR('');
  const [viewMode, setViewMode] = useStateR('card'); // 'list' or 'card'

  const years = useMemoR(() => {
    const ys = new Set();
    RDB.performances.forEach(p => { if (p.performance_date) ys.add(p.performance_date.slice(0, 4)); });
    return ['all', ...[...ys].sort().reverse()];
  }, []);

  const topVenues = useMemoR(() => {
    const counts = {};
    RDB.performances.forEach(p => { if (p.venue_name) counts[p.venue_name] = (counts[p.venue_name] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name]) => name);
  }, []);

  const filtered = useMemoR(() => {
    let list = RDB.performances.filter(p => p.performance_date);
    if (yearFilter !== 'all') list = list.filter(p => p.performance_date.startsWith(yearFilter));
    if (venueFilter !== 'all') list = list.filter(p => p.venue_name === venueFilter);
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => {
        if ((p.performance_title || '').toLowerCase().includes(q)) return true;
        if ((p.venue_name || '').toLowerCase().includes(q)) return true;
        const parts = IX.partByPerf[p.performance_id] || [];
        const personIds = [...new Set(parts.map(pa => pa.person_id))];
        return personIds.some(pid => {
          const person = IX.personById[pid];
          return person && person.person_name && person.person_name.toLowerCase().includes(q);
        });
      });
    }
    if (yearFilter !== 'all' && sortBy === 'date-desc') {
      // When viewing a specific year, default to ascending (Jan first)
      list.sort((a, b) => a.performance_date.localeCompare(b.performance_date));
    } else if (sortBy === 'date-desc') list.sort((a, b) => b.performance_date.localeCompare(a.performance_date));
    else if (sortBy === 'date-asc') list.sort((a, b) => a.performance_date.localeCompare(b.performance_date));
    else if (sortBy === 'title') list.sort((a, b) => (a.performance_title || '').localeCompare(b.performance_title || ''));
    return list;
  }, [sortBy, yearFilter, venueFilter, searchQuery]);

  // Get singer name for each performance
  const perfSinger = useMemoR(() => {
    const map = {};
    RDB.performances.forEach(p => {
      const parts = IX.partByPerf[p.performance_id] || [];
      const singerIds = [...new Set(parts.map(pa => pa.person_id))];
      const singer = singerIds.map(pid => IX.personById[pid]).find(pe => pe && pe.person_role === 'main performer');
      if (singer) map[p.performance_id] = singer;
    });
    return map;
  }, []);

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 active="Performances" />
      <PageHeader kicker="ALL RECITALS" title="PERFORMANCES" count={String(filtered.length)} sub="모든 독창회 목록. 공연을 클릭하면 프로그램과 출연진을 볼 수 있습니다." />

      <section style={{ padding: '16px 56px', borderBottom: '1px solid var(--rule)' }}>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="공연 제목, 성악가, 반주자, 공연장 검색..."
          style={{ width: '100%', padding: '14px 20px', fontSize: 16, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none', marginBottom: 12 }} />

        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', marginBottom: 6, marginTop: 8 }}>YEAR</div>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', marginBottom: 12 }}>
          {years.map(y => (
            <button key={y} onClick={() => setYearFilter(y)} className="mono" style={{ background: yearFilter === y ? 'var(--coral)' : 'transparent', color: yearFilter === y ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '8px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
              {y === 'all' ? 'ALL' : y}
            </button>
          ))}
        </div>

        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', marginBottom: 6 }}>VENUE</div>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setVenueFilter('all')} className="mono" style={{ background: venueFilter === 'all' ? 'var(--coral)' : 'transparent', color: venueFilter === 'all' ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '8px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>ALL</button>
          {topVenues.map(v => (
            <button key={v} onClick={() => setVenueFilter(v)} className="mono" style={{ background: venueFilter === v ? 'var(--coral)' : 'transparent', color: venueFilter === v ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '8px 12px', fontSize: 10, cursor: 'pointer' }}>
              {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['list', '☰'], ['card', '▦']].map(([key, icon]) => (
              <button key={key} onClick={() => setViewMode(key)} style={{ background: viewMode === key ? 'var(--coral)' : 'transparent', color: viewMode === key ? 'var(--bg-deep)' : 'var(--ink-soft)', border: viewMode === key ? 'none' : '1px solid var(--rule)', padding: '6px 12px', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
                {icon}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[['date-desc', 'NEWEST'], ['date-asc', 'OLDEST'], ['title', 'TITLE']].map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)} className="mono" style={{ background: 'transparent', color: sortBy === key ? 'var(--coral)' : 'var(--ink-soft)', border: sortBy === key ? '1px solid var(--coral)' : '1px solid var(--rule)', padding: '8px 12px', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {viewMode === 'list' ? (
        <section style={{ padding: '0 56px 80px' }}>
          {filtered.map((p, idx) => {
            const singer = perfSinger[p.performance_id];
            const perfIdNum = p.performance_id.replace('PERF_', '');
            const ym = p.performance_date ? p.performance_date.slice(0, 7) : '';
            const prevYm = idx > 0 && filtered[idx - 1].performance_date ? filtered[idx - 1].performance_date.slice(0, 7) : '';
            const showMonthHeader = ym && ym !== prevYm;

            return (
              <React.Fragment key={p.performance_id}>
                {showMonthHeader && (
                  <div style={{ padding: '28px 0 12px', borderBottom: '2px solid var(--rule)', marginTop: idx > 0 ? 24 : 0 }}>
                    <span className="display coral" style={{ fontSize: 36 }}>{ym.replace('-', '.')}</span>
                  </div>
                )}
                <a href={'#/detail/' + perfIdNum} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 180px 160px 100px 30px', gap: 16, padding: '18px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline', textDecoration: 'none', color: 'inherit' }}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.performance_date}</span>
                  <span className="display-kr" style={{ fontSize: 20 }}>{p.performance_title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.venue_name}</span>
                  <span className="display-kr" style={{ fontSize: 14 }}>{singer ? singer.person_name : ''}</span>
                  <span className="mono coral" style={{ fontSize: 10, letterSpacing: '0.1em' }}>{singer ? (singer.person_medium || '').toUpperCase() : ''}</span>
                  <span className="coral" style={{ fontSize: 16, textAlign: 'right' }}>→</span>
                </a>
              </React.Fragment>
            );
          })}
        </section>
      ) : (
        <section style={{ padding: '24px 56px 80px' }}>
          {(() => {
            const groups = [];
            let currentYm = '';
            filtered.forEach(p => {
              const ym = p.performance_date ? p.performance_date.slice(0, 7) : '';
              if (ym !== currentYm) {
                groups.push({ ym, items: [] });
                currentYm = ym;
              }
              groups[groups.length - 1].items.push(p);
            });
            // Deterministic pseudo-random from ID
            const hashNum = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; };

            return groups.map(g => (
              <div key={g.ym}>
                <div style={{ padding: '28px 0 16px', borderBottom: '2px solid var(--rule)', marginTop: 16 }}>
                  <span className="display coral" style={{ fontSize: 36 }}>{g.ym.replace('-', '.')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 32, paddingTop: 28 }}>
                  {g.items.map(p => {
                    const singer = perfSinger[p.performance_id];
                    const perfIdNum = p.performance_id.replace('PERF_', '');
                    const h = hashNum(perfIdNum);
                    const rotate = ((h % 7) - 3) * 0.7;
                    const tapeRotate = ((h >> 4) % 5 - 2) * 3;
                    const tapeLeft = 30 + ((h >> 8) % 40);
                    return (
                      <a key={p.performance_id} href={'#/detail/' + perfIdNum} style={{ textDecoration: 'none', color: 'inherit', transform: `rotate(${rotate}deg)`, transition: 'transform 0.25s ease, box-shadow 0.25s ease', display: 'block' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.04)'; e.currentTarget.style.zIndex = '10'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${rotate}deg)`; e.currentTarget.style.zIndex = '1'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ position: 'relative', background: '#111', aspectRatio: '3/4', overflow: 'hidden', boxShadow: '2px 4px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)' }}>
                          {/* Tape strip */}
                          <div style={{ position: 'absolute', top: -6, left: tapeLeft + '%', transform: `rotate(${tapeRotate}deg)`, width: 48, height: 18, background: 'rgba(255,248,220,0.55)', zIndex: 2, backdropFilter: 'blur(1px)', borderRadius: 1 }} />
                          <img src={'viewer/data/thumbnails/' + perfIdNum + '.gif'} alt={p.performance_title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'viewer/data/1024/' + perfIdNum + '.jpg'; }} />
                          {/* Subtle worn edge overlay */}
                          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                        </div>
                        <div style={{ padding: '10px 4px 0' }}>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.performance_date}</div>
                          <div className="display-kr" style={{ fontSize: 15, marginTop: 3, lineHeight: 1.3 }}>{p.performance_title}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{p.venue_name}</div>
                          {singer && (
                            <div style={{ marginTop: 4 }}>
                              <span className="display-kr" style={{ fontSize: 12 }}>{singer.person_name}</span>
                              <span className="mono coral" style={{ fontSize: 9, marginLeft: 6 }}>{(singer.person_medium || '').toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </section>
      )}
    </div>
  );
}

/* ================= CONTRIBUTE PAGE (RDB-powered) ================= */
function ContributeRDB() {
  const [form, setForm] = useStateR({
    title: '', date: '', startTime: '', durationMinutes: '', venue: '',
    host: '', sponsor: '', youtube: '',
    singerName: '', singerMedium: 'soprano', singerProfile: '',
    accName: '', accMedium: 'piano', accProfile: ''
  });
  const [programItems, setProgramItems] = useStateR([]);
  const [posterData, setPosterData] = useStateR(null);
  const [brochures, setBrochures] = useStateR([]);
  const [submitted, setSubmitted] = useStateR(false);

  // Work search
  const [workSearch, setWorkSearch] = useStateR('');
  const [mbSearch, setMbSearch] = useStateR('');
  const [mbResults, setMbResults] = useStateR([]);
  const [mbLoading, setMbLoading] = useStateR(false);
  const [showAddWork, setShowAddWork] = useStateR(false);
  const [customWork, setCustomWork] = useStateR({ title: '', composer: '', language: '' });

  const workSuggestions = useMemoR(() => {
    if (workSearch.length < 2) return [];
    const q = workSearch.toLowerCase();
    return RDB.works.filter(w => {
      const title = (w.mb_title || w.title_variant || '').toLowerCase();
      const composer = (w.mb_composer || '').toLowerCase();
      return title.includes(q) || composer.includes(q);
    }).slice(0, 12);
  }, [workSearch]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function addWorkFromRDB(work) {
    setProgramItems(prev => [...prev, {
      id: 'existing_' + work.work_id,
      work_id: work.work_id,
      title: work.mb_title || work.title_variant,
      composer: work.mb_composer || '',
      language: work.mb_language || '',
      source: 'rdb'
    }]);
    setWorkSearch('');
  }

  function addWorkFromMB(mbWork) {
    setProgramItems(prev => [...prev, {
      id: 'mb_' + mbWork.id,
      work_id: null,
      mbid: mbWork.id,
      title: mbWork.title,
      composer: mbWork.relations?.find(r => r.type === 'composer')?.artist?.name || mbWork['artist-credit']?.[0]?.name || '',
      language: mbWork.language || '',
      source: 'musicbrainz'
    }]);
    setMbSearch('');
    setMbResults([]);
  }

  function addCustomWork() {
    if (!customWork.title) return;
    setProgramItems(prev => [...prev, {
      id: 'custom_' + Date.now(),
      work_id: null,
      title: customWork.title,
      composer: customWork.composer,
      language: customWork.language,
      source: 'custom'
    }]);
    setCustomWork({ title: '', composer: '', language: '' });
    setShowAddWork(false);
  }

  function addIntermission() {
    setProgramItems(prev => [...prev, { id: 'int_' + Date.now(), isIntermission: true }]);
  }

  function removeItem(id) {
    setProgramItems(prev => prev.filter(x => x.id !== id));
  }

  function moveItem(id, dir) {
    setProgramItems(prev => {
      const idx = prev.findIndex(x => x.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }

  async function searchMusicBrainz() {
    if (mbSearch.length < 2) return;
    setMbLoading(true);
    try {
      const res = await fetch('https://musicbrainz.org/ws/2/work?query=' + encodeURIComponent(mbSearch) + '&fmt=json&limit=10', {
        headers: { 'User-Agent': 'KoVox/1.0 (https://happyhillll.github.io)' }
      });
      const data = await res.json();
      setMbResults(data.works || []);
    } catch (e) {
      console.error('MusicBrainz search failed:', e);
      setMbResults([]);
    }
    setMbLoading(false);
  }

  function handlePoster(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPosterData(reader.result);
    reader.readAsDataURL(file);
  }

  function handleBrochures(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setBrochures(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  }

  const SHEETS_API = 'https://script.google.com/macros/s/AKfycbzM-Yw5bSkJeJGjliN4ftAHjhQwX-ILiZO7PaGzLmNPIBmv1aL5uDlC1DwlB9Xzvv5fEw/exec';
  const [submitting, setSubmitting] = useStateR(false);
  const [submitError, setSubmitError] = useStateR(null);

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const id = 'USER_' + Date.now();
    const submission = {
      id,
      title: form.title,
      date: form.date,
      startTime: form.startTime,
      duration: form.durationMinutes || '',
      venue: form.venue,
      host: form.host,
      sponsor: form.sponsor,
      youtube: form.youtube,
      singerName: form.singerName,
      singerMedium: form.singerMedium,
      singerProfile: form.singerProfile,
      accName: form.accName,
      accMedium: form.accMedium,
      accProfile: form.accProfile,
      program: programItems,
      poster: posterData ? '(image attached)' : '',
      brochures: brochures.length > 0 ? brochures : [],
      submittedAt: new Date().toISOString()
    };

    // Save to localStorage
    try {
      const localSub = {
        id,
        performance_id: 'PERF_' + id,
        performance_title: form.title,
        performance_date: form.date,
        start_time: form.startTime,
        duration_minutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
        venue_name: form.venue,
        host: form.host,
        sponsor: form.sponsor,
        youtube: form.youtube,
        singer: { name: form.singerName, medium: form.singerMedium, profile: form.singerProfile },
        accompanist: form.accName ? { name: form.accName, medium: form.accMedium, profile: form.accProfile } : null,
        program: programItems,
        poster: posterData,
        brochures: brochures,
        submittedAt: new Date().toISOString()
      };
      const existing = JSON.parse(localStorage.getItem('kovox_submissions') || '[]');
      existing.push(localSub);
      localStorage.setItem('kovox_submissions', JSON.stringify(existing));
    } catch (e) {
      console.error('localStorage save failed:', e);
    }

    // Send to Google Sheets
    try {
      await fetch(SHEETS_API, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });
    } catch (e) {
      console.error('Google Sheets submission failed:', e);
      setSubmitError('Google Sheets 전송에 실패했지만, 로컬에는 저장되었습니다.');
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  const inputStyle = { width: '100%', padding: '14px 16px', fontSize: 15, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none' };

  if (submitted) {
    return (
      <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
        <Nav2 />
        <section style={{ padding: '120px 56px', textAlign: 'center' }}>
          <div className="display coral" style={{ fontSize: 64, marginBottom: 24 }}>SUBMITTED</div>
          <p style={{ fontSize: 18, color: 'var(--ink-soft)' }}>공연 정보가 등록되었습니다.</p>
          <a href="#/performances" className="kv2-btn" style={{ display: 'inline-block', marginTop: 32, padding: '16px 32px', fontSize: 15, textDecoration: 'none' }}>공연 목록 보기 →</a>
        </section>
      </div>
    );
  }

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 />
      <PageHeader kicker="CONTRIBUTE · 참여형 아카이브" title="ADD A RECITAL" sub="공연 정보를 등록하세요. 프로그램의 곡을 검색하여 추가할 수 있습니다." />

      <div style={{ padding: '0 56px 80px', maxWidth: 980 }}>
        {/* Basic info */}
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● PERFORMANCE INFO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 32 }}>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>TITLE / 공연 제목 *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} style={inputStyle} placeholder="예: 소프라노 홍길동 독창회" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>DATE *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>START TIME</label>
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>DURATION (MIN)</label>
              <input type="number" value={form.durationMinutes} onChange={e => set('durationMinutes', e.target.value)} style={inputStyle} placeholder="90" />
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>VENUE / 공연장 *</label>
              <input value={form.venue} onChange={e => set('venue', e.target.value)} style={inputStyle} placeholder="예: 금호아트홀 연세" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>HOST / 주최</label>
              <input value={form.host} onChange={e => set('host', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>SPONSOR / 후원</label>
              <input value={form.sponsor} onChange={e => set('sponsor', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>YOUTUBE LINK</label>
              <input value={form.youtube} onChange={e => set('youtube', e.target.value)} style={inputStyle} placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>
        </div>

        {/* Singer */}
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● SINGER / 성악가</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 16, marginBottom: 12 }}>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>NAME *</label>
            <input value={form.singerName} onChange={e => set('singerName', e.target.value)} style={inputStyle} placeholder="성악가 이름" />
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>VOICE TYPE</label>
            <select value={form.singerMedium} onChange={e => set('singerMedium', e.target.value)} style={inputStyle}>
              <option value="soprano">Soprano</option><option value="mezzo-soprano">Mezzo-Soprano</option>
              <option value="tenor">Tenor</option><option value="baritone">Baritone</option><option value="bass">Bass</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 32 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>PROFILE / 프로필</label>
          <textarea value={form.singerProfile} onChange={e => set('singerProfile', e.target.value)} rows="3" style={{ ...inputStyle, resize: 'vertical' }} placeholder="성악가 약력 (선택)" />
        </div>

        {/* Accompanist */}
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● ACCOMPANIST / 반주자</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 16, marginBottom: 12 }}>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>NAME</label>
            <input value={form.accName} onChange={e => set('accName', e.target.value)} style={inputStyle} placeholder="반주자 이름" />
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>INSTRUMENT</label>
            <select value={form.accMedium} onChange={e => set('accMedium', e.target.value)} style={inputStyle}>
              <option value="piano">Piano</option><option value="cello">Cello</option><option value="violin">Violin</option>
              <option value="flute">Flute</option><option value="guitar">Guitar</option><option value="harp">Harp</option>
              <option value="organ">Organ</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 32 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>PROFILE / 프로필</label>
          <textarea value={form.accProfile} onChange={e => set('accProfile', e.target.value)} rows="2" style={{ ...inputStyle, resize: 'vertical' }} placeholder="반주자 약력 (선택)" />
        </div>

        {/* Programme */}
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● PROGRAMME / 프로그램</div>

        {/* Current programme list */}
        {programItems.length > 0 && (
          <div style={{ marginBottom: 20, border: '1px solid var(--rule)', padding: 16 }}>
            {programItems.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: idx > 0 ? '1px solid var(--rule)' : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveItem(item.id, -1)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 10, padding: 2 }}>▲</button>
                  <button onClick={() => moveItem(item.id, 1)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 10, padding: 2 }}>▼</button>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', width: 24 }}>{idx + 1}</span>
                {item.isIntermission ? (
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic', flex: 1 }}>— INTERMISSION —</span>
                ) : (
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 15 }}>{item.title}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 10 }}>{item.composer}</span>
                    {item.source === 'musicbrainz' && <span className="mono" style={{ fontSize: 9, color: '#6bc5f5', marginLeft: 6, border: '1px solid #6bc5f5', padding: '1px 4px' }}>MB</span>}
                    {item.source === 'custom' && <span className="mono" style={{ fontSize: 9, color: '#e8c547', marginLeft: 6, border: '1px solid #e8c547', padding: '1px 4px' }}>NEW</span>}
                  </div>
                )}
                <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Search works from RDB */}
        <div style={{ marginBottom: 12 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>SEARCH EXISTING WORKS / 기존 곡 검색</label>
          <input value={workSearch} onChange={e => setWorkSearch(e.target.value)} style={inputStyle} placeholder="곡 제목 또는 작곡가 이름으로 검색..." />
        </div>
        {workSuggestions.length > 0 && (
          <div style={{ marginBottom: 16, border: '1px solid var(--rule)', maxHeight: 250, overflowY: 'auto', background: 'var(--bg-deep)' }}>
            {workSuggestions.map(w => (
              <div key={w.work_id} onClick={() => addWorkFromRDB(w)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--rule)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,123,107,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 14 }}>{w.mb_title || w.title_variant}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 10 }}>{w.mb_composer || ''}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 8 }}>{langName(w.mb_language)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search MusicBrainz */}
        <div style={{ marginBottom: 12 }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>SEARCH MUSICBRAINZ / 새로운 곡 검색</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={mbSearch} onChange={e => setMbSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="MusicBrainz에서 곡 검색..."
              onKeyDown={e => { if (e.key === 'Enter') searchMusicBrainz(); }} />
            <button onClick={searchMusicBrainz} className="kv2-btn" style={{ padding: '14px 20px', border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              {mbLoading ? '...' : '검색'}
            </button>
          </div>
        </div>
        {mbResults.length > 0 && (
          <div style={{ marginBottom: 16, border: '1px solid #6bc5f5', maxHeight: 300, overflowY: 'auto', background: 'var(--bg-deep)' }}>
            <div className="mono" style={{ fontSize: 10, color: '#6bc5f5', padding: '8px 16px', letterSpacing: '0.15em', borderBottom: '1px solid var(--rule)' }}>MUSICBRAINZ RESULTS</div>
            {mbResults.map(w => (
              <div key={w.id} onClick={() => addWorkFromMB(w)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--rule)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(107,197,245,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 14 }}>{w.title}</span>
                {w['artist-credit'] && w['artist-credit'][0] && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 10 }}>{w['artist-credit'][0].name}</span>
                )}
                {w.language && <span className="mono" style={{ fontSize: 10, color: '#6bc5f5', marginLeft: 8 }}>{w.language}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Manual add / Intermission */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <button onClick={() => setShowAddWork(!showAddWork)} className="mono" style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-soft)', padding: '10px 16px', fontSize: 11, cursor: 'pointer' }}>
            + 직접 입력
          </button>
          <button onClick={addIntermission} className="mono" style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-soft)', padding: '10px 16px', fontSize: 11, cursor: 'pointer' }}>
            + INTERMISSION
          </button>
        </div>

        {showAddWork && (
          <div style={{ marginBottom: 32, padding: 16, border: '1px solid var(--rule)', background: 'var(--bg-deep)' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', marginBottom: 12 }}>직접 곡 정보 입력</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px', gap: 12, marginBottom: 12 }}>
              <input value={customWork.title} onChange={e => setCustomWork(c => ({ ...c, title: e.target.value }))} style={inputStyle} placeholder="곡 제목" />
              <input value={customWork.composer} onChange={e => setCustomWork(c => ({ ...c, composer: e.target.value }))} style={inputStyle} placeholder="작곡가" />
              <input value={customWork.language} onChange={e => setCustomWork(c => ({ ...c, language: e.target.value }))} style={inputStyle} placeholder="언어" />
            </div>
            <button onClick={addCustomWork} className="kv2-btn" style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 12 }}>추가</button>
          </div>
        )}

        {/* Images */}
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● IMAGES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>POSTER / 포스터</label>
            <input type="file" accept="image/*" onChange={handlePoster} style={{ fontSize: 13, color: 'var(--ink-soft)' }} />
            {posterData && <img src={posterData} alt="Poster preview" style={{ width: 150, height: 'auto', marginTop: 12, border: '1px solid var(--rule)' }} />}
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>BROCHURE / 브로슈어 (복수 가능)</label>
            <input type="file" accept="image/*" multiple onChange={handleBrochures} style={{ fontSize: 13, color: 'var(--ink-soft)' }} />
            {brochures.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {brochures.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt={'Brochure ' + (i + 1)} style={{ width: 100, height: 'auto', border: '1px solid var(--rule)' }} />
                    <button onClick={() => setBrochures(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* YouTube preview */}
        {form.youtube && getYoutubeId(form.youtube) && (
          <div style={{ marginBottom: 32 }}>
            <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 12 }}>● VIDEO PREVIEW</div>
            <div style={{ position: 'relative', width: '100%', maxWidth: 560, paddingBottom: '315px', background: '#000' }}>
              <iframe src={'https://www.youtube.com/embed/' + getYoutubeId(form.youtube)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end', gap: 16, borderTop: '1px solid var(--rule)', paddingTop: 32 }}>
          <button onClick={submit} disabled={submitting || !(form.title && form.date && form.venue && form.singerName)} className="kv2-btn" style={{ padding: '16px 40px', fontSize: 16, border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: (form.title && form.date && form.venue && form.singerName && !submitting) ? 1 : 0.4 }}>
            {submitting ? '제출 중...' : '아카이브에 제출 →'}
          </button>
        </div>

        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 16, lineHeight: 1.8 }}>
          * 데이터는 Google Sheets와 로컬 브라우저에 동시 저장됩니다.
        </div>
      </div>
    </div>
  );
}

function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^?&#]+)/);
  return m ? m[1] : null;
}

/* ================= SEARCH PAGE ================= */
function SearchPage() {
  const [query, setQuery] = useStateR('');
  const [mode, setMode] = useStateR('all'); // 'all' or 'program'
  const [programQuery, setProgramQuery] = useStateR(''); // comma-separated composers
  const inputRef = useRefR(null);

  useEffectR(() => { if (inputRef.current) inputRef.current.focus(); }, [mode]);

  // Universal search results
  const results = useMemoR(() => {
    if (mode !== 'all' || query.length < 2) return { singers: [], accompanists: [], composers: [], works: [], performances: [], venues: [] };
    const q = query.toLowerCase();

    const singers = RDB.persons.filter(p => p.person_role === 'main performer' && p.person_name && p.person_name.toLowerCase().includes(q)).slice(0, 15);
    const accompanists = RDB.persons.filter(p => p.person_role === 'accompanist' && p.person_name && p.person_name.toLowerCase().includes(q)).slice(0, 10);

    const composerSet = new Set();
    const composers = [];
    RDB.works.forEach(w => {
      if (w.mb_composer && w.mb_composer.toLowerCase().includes(q) && !composerSet.has(w.mb_composer)) {
        composerSet.add(w.mb_composer);
        composers.push(w.mb_composer);
      }
    });

    const works = RDB.works.filter(w => {
      const title = (w.mb_title || w.title_variant || '').toLowerCase();
      return title.includes(q);
    }).slice(0, 15);

    const performances = RDB.performances.filter(p => {
      return (p.performance_title || '').toLowerCase().includes(q);
    }).slice(0, 15);

    const venueSet = new Set();
    const venues = [];
    RDB.performances.forEach(p => {
      if (p.venue_name && p.venue_name.toLowerCase().includes(q) && !venueSet.has(p.venue_name)) {
        venueSet.add(p.venue_name);
        venues.push({ name: p.venue_name, count: RDB.performances.filter(x => x.venue_name === p.venue_name).length });
      }
    });
    venues.sort((a, b) => b.count - a.count);

    return { singers, accompanists, composers: composers.slice(0, 15), works, performances, venues: venues.slice(0, 10) };
  }, [query, mode]);

  // Program search results
  const programResults = useMemoR(() => {
    if (mode !== 'program' || programQuery.length < 2) return [];
    const queries = programQuery.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
    if (queries.length === 0) return [];

    // Find performances that contain ALL queried composers
    const perfComposers = {};
    RDB.programs.forEach(pr => {
      if (!pr.work_id || pr.is_intermission === 'TRUE') return;
      const work = IX.workById[pr.work_id];
      if (!work || !work.mb_composer) return;
      if (!perfComposers[pr.performance_id]) perfComposers[pr.performance_id] = new Set();
      perfComposers[pr.performance_id].add(work.mb_composer.toLowerCase());
    });

    // Also search by work title
    const perfWorks = {};
    RDB.programs.forEach(pr => {
      if (!pr.work_id || pr.is_intermission === 'TRUE') return;
      const work = IX.workById[pr.work_id];
      if (!work) return;
      const title = (work.mb_title || work.title_variant || '').toLowerCase();
      if (!perfWorks[pr.performance_id]) perfWorks[pr.performance_id] = [];
      perfWorks[pr.performance_id].push({ work, title });
    });

    return Object.entries(perfComposers)
      .filter(([perfId, composers]) => {
        return queries.every(q =>
          [...composers].some(c => c.includes(q)) ||
          (perfWorks[perfId] || []).some(w => w.title.includes(q))
        );
      })
      .map(([perfId, composers]) => {
        const perf = IX.perfById[perfId];
        const matchedComposers = queries.filter(q => [...composers].some(c => c.includes(q)));
        const matchedWorks = queries.filter(q => (perfWorks[perfId] || []).some(w => w.title.includes(q)));
        return { perf, composers: [...composers], matchedComposers, matchedWorks };
      })
      .filter(x => x.perf)
      .sort((a, b) => (b.perf.performance_date || '').localeCompare(a.perf.performance_date || ''))
      .slice(0, 50);
  }, [programQuery, mode]);

  const totalResults = results.singers.length + results.accompanists.length + results.composers.length + results.works.length + results.performances.length + results.venues.length;

  return (
    <div className="kv2" style={{ width: '100%', maxWidth: 1440, margin: '0 auto', minHeight: '100vh' }}>
      <Nav2 />
      <section style={{ padding: '60px 56px 40px' }}>
        <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 20 }}>● SEARCH</div>
        <h1 className="display" style={{ fontSize: 96, lineHeight: 0.9, margin: 0, letterSpacing: '-0.03em' }}>SEARCH</h1>
      </section>

      <section style={{ padding: '0 56px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[['all', 'UNIVERSAL SEARCH'], ['program', 'PROGRAM SEARCH']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} className="display" style={{ background: mode === key ? 'var(--coral)' : 'transparent', color: mode === key ? 'var(--bg-deep)' : 'var(--ink-soft)', border: 'none', borderRight: '1px solid var(--rule)', padding: '16px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: '0.1em' }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: '32px 56px' }}>
        {mode === 'all' && (
          <div>
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="성악가, 반주자, 작곡가, 곡 제목, 공연장 검색..."
              style={{ width: '100%', padding: '20px 24px', fontSize: 20, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none' }} />
            {query.length >= 2 && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 12 }}>{totalResults} results</div>
            )}
          </div>
        )}
        {mode === 'program' && (
          <div>
            <input ref={inputRef} type="text" value={programQuery} onChange={e => setProgramQuery(e.target.value)}
              placeholder="작곡가 또는 곡 제목을 쉼표로 구분 (예: Schubert, Mozart)"
              style={{ width: '100%', padding: '20px 24px', fontSize: 20, background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink)', fontFamily: 'Pretendard', outline: 'none' }} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 12 }}>
              {programQuery.length >= 2 ? programResults.length + ' programmes found' : '쉼표로 구분하면 모든 키워드가 포함된 프로그램을 찾습니다'}
            </div>
          </div>
        )}
      </section>

      {/* Universal search results */}
      {mode === 'all' && query.length >= 2 && (
        <section style={{ padding: '0 56px 80px' }}>
          {results.singers.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● SINGERS ({results.singers.length})</div>
              {results.singers.map(s => (
                <a key={s.person_id} href={'#/singer/' + s.person_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                  <span className="display-kr" style={{ fontSize: 24 }}>{s.person_name}</span>
                  <span className="mono coral" style={{ fontSize: 11 }}>{(s.person_medium || '').toUpperCase()}</span>
                </a>
              ))}
            </div>
          )}
          {results.accompanists.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● ACCOMPANISTS ({results.accompanists.length})</div>
              {results.accompanists.map(a => (
                <a key={a.person_id} href={'#/person/' + a.person_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                  <span className="display-kr" style={{ fontSize: 24 }}>{a.person_name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{(a.person_medium || '').toUpperCase()}</span>
                </a>
              ))}
            </div>
          )}
          {results.composers.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● COMPOSERS ({results.composers.length})</div>
              {results.composers.map(c => (
                <div key={c} style={{ padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
                  <span className="display" style={{ fontSize: 24 }}>{c.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
          {results.works.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● WORKS ({results.works.length})</div>
              {results.works.map(w => (
                <a key={w.work_id} href={'#/work/' + w.work_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid var(--rule)', textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <span style={{ fontSize: 16 }}>{w.mb_title || w.title_variant}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 12 }}>{w.mb_composer || ''}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{langName(w.mb_language)}</span>
                </a>
              ))}
            </div>
          )}
          {results.performances.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● PERFORMANCES ({results.performances.length})</div>
              {results.performances.map(p => (
                <div key={p.performance_id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 240px', gap: 24, padding: '14px 0', borderTop: '1px solid var(--rule)', alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.performance_date}</span>
                  <span className="display-kr" style={{ fontSize: 20 }}>{p.performance_title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{p.venue_name}</span>
                </div>
              ))}
            </div>
          )}
          {results.venues.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="mono coral" style={{ fontSize: 12, letterSpacing: '0.25em', marginBottom: 16 }}>● VENUES ({results.venues.length})</div>
              {results.venues.map(v => (
                <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
                  <span style={{ fontSize: 18 }}>{v.name}</span>
                  <span className="mono coral" style={{ fontSize: 13 }}>{v.count} performances</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Program search results */}
      {mode === 'program' && programQuery.length >= 2 && (
        <section style={{ padding: '0 56px 80px' }}>
          {programResults.map(({ perf, composers }) => {
            const progs = (IX.progByPerf[perf.performance_id] || [])
              .filter(pr => pr.work_id && pr.is_intermission !== 'TRUE')
              .sort((a, b) => (a.program_order || 0) - (b.program_order || 0));
            return (
              <div key={perf.performance_id} style={{ marginBottom: 32, padding: '24px', borderTop: '1px solid var(--rule)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{perf.performance_date}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 16 }}>{perf.venue_name}</span>
                  </div>
                </div>
                <h3 className="display-kr" style={{ fontSize: 28, margin: '0 0 16px' }}>{perf.performance_title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[...new Set(composers)].map(c => (
                    <span key={c} className="mono" style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg-deep)', border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}>
                      {c.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--rule)' }}>
                  {progs.slice(0, 12).map(pr => {
                    const work = IX.workById[pr.work_id];
                    if (!work) return null;
                    const queries = programQuery.split(',').map(s => s.trim().toLowerCase());
                    const isMatch = queries.some(q =>
                      (work.mb_composer || '').toLowerCase().includes(q) ||
                      (work.mb_title || work.title_variant || '').toLowerCase().includes(q)
                    );
                    return (
                      <div key={pr.program_item_id} style={{ padding: '6px 0', fontSize: 14, color: isMatch ? 'var(--ink)' : 'var(--ink-soft)' }}>
                        <span style={{ fontWeight: isMatch ? 600 : 400 }}>{work.mb_title || work.title_variant}</span>
                        <span className="mono" style={{ fontSize: 10, marginLeft: 8, color: 'var(--ink-soft)' }}>{work.mb_composer || ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ================= EXPORTS ================= */
window.KoVoxPagesRDB = { SingersRDB, SingerProfile, Repertoire, WorkDetail, Network, SearchPage, PerformancesList, DetailProgramme, ComposerDetail, ReviewSection, ContributeRDB };
