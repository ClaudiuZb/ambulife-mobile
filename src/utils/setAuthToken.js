// src/utils/setAuthToken.js
import axios from './axios';

const setAuthToken = token => {
  if (token) {
    // Setăm header-ele pentru toate request-urile viitoare
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Păstrăm compatibilitatea cu x-auth-token
    axios.defaults.headers.common['x-auth-token'] = token;
  } else {
    // Ștergem header-ele dacă nu avem token
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['x-auth-token'];
  }
};

export default setAuthToken;
