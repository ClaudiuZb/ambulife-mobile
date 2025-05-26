// src/utils/axios.js - ÎNLOCUIEȘTE COMPLET FIȘIERUL EXISTENT
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from './config';

console.log('Creating axios instance with base URL:', config.API_URL);

const axiosInstance = axios.create({
  baseURL: config.API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: config.REQUEST_TIMEOUT
});

// Request interceptor - debugging îmbunătățit
axiosInstance.interceptors.request.use(
  async (requestConfig) => {
    const token = await AsyncStorage.getItem('token');
    
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
      requestConfig.headers['x-auth-token'] = token;
    }
    
    console.log('==========================');
    console.log('===== AXIOS REQUEST =====');
    console.log('URL:', requestConfig.url);
    console.log('Full URL:', requestConfig.baseURL + requestConfig.url);
    console.log('Method:', requestConfig.method?.toUpperCase());
    console.log('Headers:', requestConfig.headers);
    console.log('Body:', requestConfig.data);
    console.log('==========================');
    
    return requestConfig;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - debugging îmbunătățit
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('==========================');
    console.log('===== AXIOS RESPONSE =====');
    console.log('Status:', response.status);
    console.log('URL:', response.config.url);
    console.log('Data:', response.data);
    console.log('==========================');
    return response;
  },
  async (error) => {
    console.log('==========================');
    console.log('===== AXIOS ERROR =====');
    
    if (error.response) {
      // Server a răspuns cu status code în afara range-ului 2xx
      console.error('Response error:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // Request a fost făcut dar nu s-a primit răspuns
      console.error('No response received. Raw request object:');
      console.error(error.request);
      console.log('Original error message:', error.message);
      console.log('Complete error object:', error);
      
      // Verifică dacă e problemă de conexiune
      if (error.message === 'Network Error') {
        console.error('\n⚠️  NETWORK ERROR - Verifică:');
        console.error('1. Backend-ul rulează pe portul 5000?');
        console.error('2. IP-ul din config.js este corect? (curent:', config.API_URL, ')');
        console.error('3. Telefonul este pe aceeași rețea WiFi cu computerul?');
        console.error('4. Firewall-ul permite conexiuni pe portul 5000?');
        console.error('5. Pentru Windows, rulează în CMD ca administrator:');
        console.error('   netsh advfirewall firewall add rule name="Node 5000" dir=in action=allow protocol=TCP localport=5000');
      }
    } else {
      // Altceva a cauzat eroarea
      console.error('Error setting up request:', error.message);
    }
    
    console.log('=========================\n');
    
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;

