import { useState, useEffect, useRef } from 'react';

interface TripTrackerProps {
  onTripComplete: (miles: number) => void;
}

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
}

function calculateDistance(pos1: Position, pos2: Position): number {
  const R = 3958.8;
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function TripTracker({ onTripComplete }: TripTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const lastPosition = useRef<Position | null>(null);
  const watchId = useRef<number | null>(null);
  const durationInterval = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (durationInterval.current !== null) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const getErrorMessage = (errorCode: number, errorMsg: string): string => {
    switch (errorCode) {
      case 1: // PERMISSION_DENIED
        return 'Location permission denied. Please enable location access in your browser settings to use GPS tracking.';
      case 2: // POSITION_UNAVAILABLE
        return 'GPS signal unavailable. Make sure you\'re outdoors with clear sky view.';
      case 3: // TIMEOUT
        return 'GPS location request timed out. Please try again.';
      default:
        return `GPS Error: ${errorMsg}`;
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setError(null);
    setIsTracking(true);
    setDistance(0);
    setDuration(0);
    lastPosition.current = null;

    durationInterval.current = window.setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    const tempWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: position.timestamp,
        };

        if (lastPosition.current) {
          const dist = calculateDistance(lastPosition.current, newPos);
          if (dist > 0.001 && dist < 1) {
            setDistance(prev => prev + dist);
          }
        }

        lastPosition.current = newPos;
      },
      (error) => {
        const errorMessage = getErrorMessage(error.code, error.message);
        setError(errorMessage);
        if (tempWatchId !== undefined) {
          navigator.geolocation.clearWatch(tempWatchId);
        }
        if (durationInterval.current !== null) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
        setIsTracking(false);
        watchId.current = null;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
    
    watchId.current = tempWatchId;
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (durationInterval.current !== null) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    setIsTracking(false);
  };

  const completeTrip = () => {
    stopTracking();
    onTripComplete(parseFloat(distance.toFixed(2)));
    setDistance(0);
    setDuration(0);
    lastPosition.current = null;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg shadow-lg p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">🚗 Trip Tracker</h3>
        {isTracking && (
          <span className="flex items-center text-sm">
            <span className="animate-pulse mr-2">🔴</span>
            Live Tracking
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-20 border border-red-300 rounded p-2 mb-3 text-sm flex items-start justify-between gap-2">
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-red-200 hover:text-red-100 font-bold text-lg flex-shrink-0"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-sm opacity-90">Distance</div>
          <div className="text-2xl font-bold">{distance.toFixed(2)} mi</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-sm opacity-90">Duration</div>
          <div className="text-2xl font-bold">{formatDuration(duration)}</div>
        </div>
      </div>

      {!isTracking ? (
        <button
          onClick={startTracking}
          className="w-full bg-white text-purple-600 font-bold py-3 rounded-lg hover:bg-gray-100 transition"
        >
          ▶️ Start Trip
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={stopTracking}
            className="bg-red-500 hover:bg-red-600 font-bold py-3 rounded-lg transition"
          >
            ⏹️ Cancel
          </button>
          <button
            onClick={completeTrip}
            className="bg-green-500 hover:bg-green-600 font-bold py-3 rounded-lg transition"
          >
            ✅ Complete
          </button>
        </div>
      )}

      <div className="mt-3 text-xs opacity-75 text-center">
        {isTracking 
          ? 'GPS is tracking your location. Keep your phone active.'
          : 'Start a trip to track miles automatically using GPS'
        }
      </div>
    </div>
  );
}
