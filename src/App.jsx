import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import { Icon } from 'leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import JMFJ from './jmfj.png';
import './App.css';

const customIcon = new Icon({
  iconUrl: JMFJ,
  iconSize: [100, 147],
  iconAnchor: [50, 73],
});

const DEFAULT_COORDINATES = [51.505, -0.09];

const App = () => {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/location', { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`api responded ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setState({ status: 'ready', data: body });
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setState({ status: 'error', data: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {state.status === 'loading' && <FontAwesomeIcon icon={faSpinner} spin />}
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
          href="https://github.com/hikarukujo/witwijmfj"
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
