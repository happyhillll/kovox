/* global React, ReactDOM */
const { useState, useEffect } = React;
const Landing = window.KoVoxLanding;
const { Archive, Composers, Calendar, Detail, Contribute, Editorial, About } = window.KoVoxPages;
const { SingersRDB, SingerProfile, Repertoire, WorkDetail, Network, SearchPage, PerformancesList, ComposerDetail, ContributeRDB, CalendarPage } = window.KoVoxPagesRDB;

function App() {
  const [route, setRoute] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handler = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Scroll to top on route change
  useEffect(() => { window.scrollTo(0, 0); }, [route]);

  if (route === '#/' || route === '' || route === '#') return <Landing />;
  if (route === '#/archive') return <Archive />;
  if (route === '#/performances') return <PerformancesList />;
  if (route === '#/composers') return <Composers />;
  if (route === '#/singers') return <SingersRDB />;
  if (route === '#/calendar') return <CalendarPage />;
  if (route === '#/editorial') return <Editorial />;
  if (route === '#/contribute') return <ContributeRDB />;
  if (route === '#/about') return <About />;
  if (route === '#/repertoire') return <Repertoire />;
  if (route === '#/network') return <Network />;
  if (route === '#/search') return <SearchPage />;
  if (route.startsWith('#/composer/')) {
    const name = route.replace('#/composer/', '');
    return <ComposerDetail composerName={name} />;
  }
  if (route.startsWith('#/detail/')) {
    const id = route.replace('#/detail/', '');
    return <Detail perfId={id} />;
  }
  if (route.startsWith('#/singer/')) {
    const id = route.replace('#/singer/', '');
    return <SingerProfile personId={id} />;
  }
  if (route.startsWith('#/person/')) {
    const id = route.replace('#/person/', '');
    return <SingerProfile personId={id} />;
  }
  if (route.startsWith('#/work/')) {
    const id = route.replace('#/work/', '');
    return <WorkDetail workId={id} />;
  }

  return <Landing />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
