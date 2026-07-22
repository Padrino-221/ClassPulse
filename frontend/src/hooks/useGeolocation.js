import { useState, useEffect, useRef } from 'react';

const COLLECTION_WINDOW_MS = 10000;

export default function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accuracy, setAccuracy] = useState(null);
  const readingsRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    let watchId = null;

    const pickBest = () => {
      const readings = readingsRef.current;
      if (readings.length === 0) {
        setError('Could not get a GPS reading. Try again outdoors.');
        setLoading(false);
        return null;
      }

      // Return the reading with the smallest accuracy value (most precise)
      let best = readings[0];
      for (let i = 1; i < readings.length; i++) {
        if (readings[i].accuracy < best.accuracy) {
          best = readings[i];
        }
      }

      return best;
    };

    const onReading = (position) => {
      const reading = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      readingsRef.current.push(reading);

      // Update live accuracy so the UI can show progress
      setAccuracy(reading.accuracy);
    };

    const onError = (err) => {
      // Don't overwrite a good reading with a later error
      if (readingsRef.current.length > 0) return;

      let msg = 'Location error.';
      if (err.code === 1) msg = 'Location permission denied. Enable GPS in settings.';
      else if (err.code === 2) msg = 'Location unavailable. Try outdoors.';
      else if (err.code === 3) msg = 'Location timed out. Trying fallback...';

      setError(msg);
      setLoading(false);

      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };

    // Start watching — prefer high accuracy, collect for 10s
    watchId = navigator.geolocation.watchPosition(onReading, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    // After 10 seconds, pick the best reading and stop
    timerRef.current = setTimeout(() => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      const best = pickBest();
      if (best) {
        setCoords(best);
        setAccuracy(best.accuracy);
        setLoading(false);
      }
    }, COLLECTION_WINDOW_MS);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Allow manual restart if user wants a fresh reading
  const refresh = () => {
    setCoords(null);
    setError(null);
    setLoading(true);
    setAccuracy(null);
    readingsRef.current = [];
  };

  return { coords, error, loading, accuracy, refresh };
}
