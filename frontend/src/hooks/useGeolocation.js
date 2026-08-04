import { useState, useEffect, useRef, useCallback } from 'react';

const COLLECTION_WINDOW_MS = 15000;

export default function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const readingsRef = useRef([]);
  const timerRef = useRef(null);
  const erroredRef = useRef(false);
  const watchIdRef = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pickBest = useCallback(() => {
    const readings = readingsRef.current;
    if (readings.length === 0) {
      if (!erroredRef.current) {
        setError('Could not get a GPS reading. Try again outdoors.');
      }
      setLoading(false);
      return null;
    }

    let best = readings[0];
    for (let i = 1; i < readings.length; i++) {
      if (readings[i].accuracy < best.accuracy) {
        best = readings[i];
      }
    }
    return best;
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    // Stop any existing watcher before starting a new one
    stopWatching();

    setCoords(null);
    setError(null);
    setLoading(true);
    setAccuracy(null);
    erroredRef.current = false;
    readingsRef.current = [];

    const onReading = (position) => {
      const reading = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      readingsRef.current.push(reading);
      erroredRef.current = false;
      setAccuracy(reading.accuracy);
    };

    const onError = (err) => {
      if (readingsRef.current.length > 0) return;

      let msg = 'Location error.';
      if (err.code === 1) {
        msg = 'Location permission denied. Enable GPS in settings.';
        erroredRef.current = true;
      } else if (err.code === 2) {
        msg = 'Location unavailable. Try outdoors.';
        erroredRef.current = true;
      } else if (err.code === 3) {
        msg = 'GPS timed out, retrying...';
      }

      setError(msg);

      if (err.code === 1 || err.code === 2) {
        setLoading(false);
        stopWatching();
      }
    };

    const watchId = navigator.geolocation.watchPosition(onReading, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
    watchIdRef.current = watchId;

    timerRef.current = setTimeout(() => {
      stopWatching();
      const best = pickBest();
      if (best) {
        setCoords(best);
        setAccuracy(best.accuracy);
        setLoading(false);
      }
    }, COLLECTION_WINDOW_MS);
  }, [stopWatching, pickBest]);

  const refresh = useCallback(() => {
    stopWatching();
    startWatching();
  }, [stopWatching, startWatching]);

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  return { coords, error, loading, accuracy, refresh, startWatching };
}
