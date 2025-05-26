// src/utils/config.js - VERSIUNE ACTUALIZATĂ
import Constants from 'expo-constants';

// IP-ul tău local
const LOCAL_IP = '192.168.100.62';

// URL-ul Render pentru backend
const RENDER_API_URL = 'https://ambbackend.onrender.com';

const ENV = {
  dev: {
    API_URL: `http://${LOCAL_IP}:5000/api`,
    SOCKET_URL: `http://${LOCAL_IP}:5000`
  },
  prod: {
    API_URL: `${RENDER_API_URL}/api`,
    SOCKET_URL: RENDER_API_URL
  }
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

const config = {
  ...getEnvVars(),
  LOCATION_UPDATE_INTERVAL: 30000,
  REQUEST_TIMEOUT: 30000,
  APP_VERSION: Constants.manifest?.version || '1.0.0'
};

// Debug info
console.log('====== CONFIG ======');
console.log('API URL:', config.API_URL);
console.log('===================');

export default config;
