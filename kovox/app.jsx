/* global React, ReactDOM */
const { useState, useEffect } = React;
const Landing = window.KoVoxLanding;
const { Archive, Composers, Singers, Calendar, Detail, Contribute, Editorial, About } = window.KoVoxPages;

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
  if (route === '#/composers') return <Composers />;
  if (route === '#/singers') return <Singers />;
  if (route === '#/calendar') return <Calendar />;
  if (route === '#/editorial') return <Editorial />;
  if (route === '#/contribute') return <Contribute />;
  if (route === '#/about') return <About />;
  if (route.startsWith('#/detail/')) {
    const id = route.replace('#/detail/', '');
    return <Detail perfId={id} />;
  }

  return <Landing />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
