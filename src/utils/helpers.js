import { Dimensions, Platform } from 'react-native';
import moment from 'moment';
import 'moment/locale/ro'; // Pentru limba română

// Setează limba pentru moment
moment.locale('ro');

// Device dimensions
export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Verifică dacă e iPhone X sau mai nou
export const isIphoneX = () => {
  return (
    Platform.OS === 'ios' &&
    (SCREEN_HEIGHT === 812 || SCREEN_WIDTH === 812 || 
     SCREEN_HEIGHT === 896 || SCREEN_WIDTH === 896 ||
     SCREEN_HEIGHT === 844 || SCREEN_WIDTH === 844 ||
     SCREEN_HEIGHT === 926 || SCREEN_WIDTH === 926)
  );
};

// Formatare dată
export const formatDate = (date, format = 'DD MMM YYYY') => {
  return moment(date).format(format);
};

// Formatare dată relativă (acum 2 ore, ieri, etc.)
export const formatRelativeDate = (date) => {
  return moment(date).fromNow();
};

// Formatare sumă în lei
export const formatCurrency = (amount) => {
  return `${parseFloat(amount).toFixed(2)} LEI`;
};

// Validare email
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validare număr de telefon românesc
export const validatePhoneNumber = (phone) => {
  const re = /^(?:(?:(?:00|\+)40)|0)(?:7[0-8]{1}[0-9]{7}|2[0-9]{8}|3[0-9]{8})$/;
  return re.test(phone.replace(/\s/g, ''));
};

// Generare culoare pentru avatar bazată pe nume
export const getAvatarColor = (name) => {
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688',
    '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
    '#ffc107', '#ff9800', '#ff5722', '#795548'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Obține inițialele din nume
export const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Calculează distanța între două coordonate (în km)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raza Pământului în km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value) => {
  return value * Math.PI / 180;
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};