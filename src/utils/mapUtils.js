// src/utils/mapUtils.js
import { Platform } from 'react-native';

// Verifică dacă avem permisiuni de localizare
export const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
    const { status } = await Permissions.askAsync(Permissions.LOCATION);
    return status === 'granted';
  }
  
  const { status } = await Permissions.askAsync(Permissions.LOCATION);
  return status === 'granted';
};

// Calculează centrul geografic pentru o mulțime de coordonate
export const getCenterForCoordinates = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  // Filtrează coordonatele invalide
  const validCoordinates = coordinates.filter(
    (coord) => coord.latitude && coord.longitude
  );

  if (validCoordinates.length === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;

  // Convertește din grade în radiani și calculează mediile
  validCoordinates.forEach((coord) => {
    const lat = (coord.latitude * Math.PI) / 180;
    const lon = (coord.longitude * Math.PI) / 180;
    
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  });

  x = x / validCoordinates.length;
  y = y / validCoordinates.length;
  z = z / validCoordinates.length;

  // Convertește înapoi în grade
  const lon = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);

  return {
    latitude: (lat * 180) / Math.PI,
    longitude: (lon * 180) / Math.PI,
  };
};

// Formatează durata unei ture
export const formatWorkDuration = (startTime) => {
  if (!startTime) return 'Necunoscut';
  
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${diffHrs}h ${diffMins}m`;
};

// Formatează timpul trecut
export const formatTimeAgo = (date) => {
  if (!date) return '';
  
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `acum ${seconds} secunde`;
  if (seconds < 3600) return `acum ${Math.floor(seconds / 60)} minute`;
  if (seconds < 86400) return `acum ${Math.floor(seconds / 3600)} ore`;
  return `acum ${Math.floor(seconds / 86400)} zile`;
};