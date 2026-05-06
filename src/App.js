import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import { Icon } from 'leaflet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import JMFJ from './jmfj.png';

const customIcon = new Icon({
  iconUrl: JMFJ,
  iconSize: [100, 147], // size of the icon
  iconAnchor: [50, 73], // point of the icon which will correspond to marker's location
});

const App = () => {
  const [location, setLocation] = useState({});
  const [coordinates, setCoordinates] = useState([51.505, -0.09]); // Default to London
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cachedData, setCachedData] = useState({ timestamp: null, location: null });

  useEffect(() => {
    const fetchLocationData = async () => {
      // Check if cached data is available and less than 60 minutes old
      const currentTime = new Date().getTime();
      const oneHour = 60 * 60 * 1000;
      if (cachedData.location && (currentTime - cachedData.timestamp) < oneHour) {
        const { latitude, longitude } = cachedData.location;
        setCoordinates([latitude, longitude]);
        return { latitude, longitude };
      }
      
      try {
        const response = await axios.get('https://api.life360.com/v3/circles/e54367f0-24b6-4cc3-94da-29d998174daa/members/8f1d8944-bb77-48c6-91f5-c0a181f31b3b', {
          headers: { Authorization: `Bearer ${process.env.REACT_APP_BEARER_TOKEN}` }
        });

        const { latitude, longitude } = response.data.location;
        // Cache the data with the current timestamp
        setCachedData({ timestamp: new Date().getTime(), location: { latitude, longitude } });
        setCoordinates([latitude, longitude]);
        return { latitude, longitude };
      } catch (error) {
        setError(true);
        setLoading(false);
        console.error(`Error: ${error}`);
      }
    };

    const fetchLocationDetails = async (lat, lon) => {
      try {
        const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${process.env.REACT_APP_OPENCAGE_API_KEY}`);
        const data = response.data;
        if (data.results && data.results.length > 0) {
          const locationDetails = data.results[0].components;
          setLocation({
            city: locationDetails.city,
            state: locationDetails.state,
            country: locationDetails.country
          });
        }
        setLoading(false);
      } catch (error) {
        setError(true);
        setLoading(false);
        console.error(`Error: ${error}`);
      }
    };

    fetchLocationData()
      .then(({ latitude, longitude }) => fetchLocationDetails(latitude, longitude));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {loading ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : error ? (
          <FontAwesomeIcon icon={faTimes} />
        ) : (
          <div style={{ height: '90vh', width: '100%' }}>
            <MapContainer center={coordinates} zoom={7} style={{ height: "100%", width: "100%" }} minZoom={4} maxZoom={7} scrollWheelZoom={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={coordinates} icon={customIcon}>
                <Tooltip permanent direction="left" offset={[-11, 39]} opacity={1} >
                  {location.city}, {location.state}<br />
                  {location.country}
                </Tooltip>
              </Marker>
            </MapContainer>
          </div>
        )}
      </header>
      <footer style={{ position: 'fixed', bottom: 0, width: '100%', textAlign: 'center', padding: '10px', background: '#282c34', color: '#fff' }}>
        &copy; {new Date().getFullYear()}, JMFJ - <a href="https://github.com/hikarukujo/witwijmfj" target="_blank" rel="noopener noreferrer" style={{ color: '#61dafb' }}>GitHub Source</a>
      </footer>
    </div>
  );
};

export default App;