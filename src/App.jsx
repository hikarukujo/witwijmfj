import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import { Icon } from 'leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import JMFJ from './jmfj.png';
import './App.css';

const customIcon = new Icon({
  iconUrl: JMFJ,
  iconSize: [100, 147],
  iconAnchor: [50, 73],
});

const DEFAULT_COORDINATES = [51.505, -0.09];
const MIN_SPLASH_MS = 5000;

const App = () => {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    const fetchLocation = fetch('/api/location', { headers: { accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`api responded ${res.status}`);
        return res.json();
      })
      .catch((err) => err);

    Promise.all([fetchLocation, minDelay]).then(([result]) => {
      if (cancelled) return;
      if (result instanceof Error) {
        console.error(result);
        setState({ status: 'error', data: null });
      } else {
        setState({ status: 'ready', data: result });
      }
    });

    return () => { cancelled = true; };
  }, []);

  const splashHidden = state.status !== 'loading';

  return (
    <div className="App">
      <header className="App-header">
        {state.status === 'error' && <FontAwesomeIcon icon={faTimes} />}
        {state.status === 'ready' && (
          <div style={{ height: '90vh', width: '100%' }}>
            <MapContainer
              center={state.data.coordinates ?? DEFAULT_COORDINATES}
              zoom={7}
              minZoom={4}
              maxZoom={7}
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={state.data.coordinates ?? DEFAULT_COORDINATES} icon={customIcon}>
                <Tooltip permanent direction="left" offset={[-11, 39]} opacity={1}>
                  {[state.data.place?.city, state.data.place?.state].filter(Boolean).join(', ')}
                  <br />
                  {state.data.place?.country}
                </Tooltip>
              </Marker>
            </MapContainer>
          </div>
        )}
      </header>
      <div className={`splash${splashHidden ? ' splash-hidden' : ''}`} aria-hidden={splashHidden}>
        <img src="/witwijmfj.png" alt="" className="splash-image" />
      </div>
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          width: '100%',
          textAlign: 'center',
          padding: '10px',
          background: '#282c34',
          color: '#fff',
        }}
      >
        &copy; {new Date().getFullYear()}, JMFJ —{' '}
        <a
          href="https://github.com/hikarukujo/whereintheworldisjoejohnson-com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#61dafb' }}
        >
          GitHub Source
        </a>
      </footer>
    </div>
  );
};

export default App;
