import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../utils/axios';
import setAuthToken from '../../utils/setAuthToken';
import {
  USER_LOADING,
  USER_LOADED,
  AUTH_ERROR,
  LOGIN_SUCCESS,
  LOGIN_FAIL,
  LOGOUT,
  CLEAR_ERRORS,
  USER_UPDATE
} from './types';

// Load User
export const loadUser = () => async dispatch => {
  console.log('[AUTH] loadUser - Încep încărcarea utilizatorului');
  try {
    // Obține token din AsyncStorage
    const token = await AsyncStorage.getItem('token');
    console.log('[AUTH] loadUser - Token found:', token ? 'Yes' : 'No');
    
    if (token) {
      console.log('[AUTH] loadUser - Setez token în headers');
      setAuthToken(token);
    } else {
      console.log('[AUTH] loadUser - Nu există token, dispatch AUTH_ERROR');
      dispatch({ type: AUTH_ERROR });
      return;
    }

    console.log('[AUTH] loadUser - Dispatch USER_LOADING');
    dispatch({ type: USER_LOADING });
    
    console.log('[AUTH] loadUser - Fac cerere GET la /auth/me');
    const res = await axios.get('/auth/me');
    console.log('[AUTH] loadUser - Răspuns primit:', res.data);

    console.log('[AUTH] loadUser - Dispatch USER_LOADED cu utilizatorul');
    dispatch({
      type: USER_LOADED,
      payload: res.data.data
    });
  } catch (err) {
    console.error('[AUTH] loadUser - Eroare:', err.message || err);
    console.log('[AUTH] loadUser - Dispatch AUTH_ERROR');
    dispatch({ type: AUTH_ERROR });
  }
};

// Login User
export const login = (email, password) => async dispatch => {
  console.log('[AUTH] login - Începere proces login pentru:', email);
  
  const config = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const body = JSON.stringify({ email, password });

  try {
    console.log('[AUTH] login - Dispatch USER_LOADING');
    dispatch({ type: USER_LOADING });
    
    console.log('[AUTH] login - Trimit cerere POST la /auth/login');
    const res = await axios.post('/auth/login', body, config);
    console.log('[AUTH] login - Răspuns primit:', res.data ? 'Success' : 'Failure');

    // Salvează token în AsyncStorage
    console.log('[AUTH] login - Salvez token în AsyncStorage');
    await AsyncStorage.setItem('token', res.data.token);
    
    // Setează token pentru axios
    console.log('[AUTH] login - Setez token în headers');
    setAuthToken(res.data.token);

    console.log('[AUTH] login - Dispatch LOGIN_SUCCESS');
    dispatch({
      type: LOGIN_SUCCESS,
      payload: res.data
    });

    // Încarcă user-ul curent
    console.log('[AUTH] login - Încep loadUser după login');
    dispatch(loadUser());
  } catch (err) {
    console.error('[AUTH] login - Eroare:', err.response?.data?.message || err.message || 'Unknown error');
    console.log('[AUTH] login - Dispatch LOGIN_FAIL');
    dispatch({
      type: LOGIN_FAIL,
      payload: err.response?.data?.message || 'A apărut o eroare la autentificare'
    });
  }
};

// Logout
export const logout = () => async dispatch => {
  console.log('[AUTH] logout - Începere proces logout');
  
  try {
    // Obține starea curentă a utilizatorului (pentru debugging)
    const currentUser = await AsyncStorage.getItem('user');
    console.log('[AUTH] logout - User înainte de logout:', currentUser);
    
    // Șterge token din AsyncStorage
    console.log('[AUTH] logout - Șterg token din AsyncStorage');
    await AsyncStorage.removeItem('token');
    
    // Verifică dacă token-ul a fost șters cu succes
    const tokenAfterRemoval = await AsyncStorage.getItem('token');
    console.log('[AUTH] logout - Token după ștergere:', tokenAfterRemoval);
    
    // Șterge header-ul
    console.log('[AUTH] logout - Resetez header-ul de autorizare');
    setAuthToken(null);

    // Verifică starea Redux înainte de dispatch
    console.log('[AUTH] logout - Starea înainte de dispatch LOGOUT');
    
    // Dispatch acțiunea LOGOUT
    console.log('[AUTH] logout - Dispatch LOGOUT');
    dispatch({ type: LOGOUT });
    
    console.log('[AUTH] logout - LOGOUT dispatched cu succes');
    
    // Verifică dacă sunt servicii care încă rulează
    console.log('[AUTH] logout - Verificare servicii active');
    
    // Apelul pentru deconectarea socketului s-a făcut deja în handleLogout
    console.log('[AUTH] logout - Procesul de logout finalizat');
  } catch (err) {
    console.error('[AUTH] logout - Eroare în timpul procesului de logout:', err.message || err);
  }
};

// Clear Errors
export const clearErrors = () => dispatch => {
  console.log('[AUTH] clearErrors - Clearing errors');
  dispatch({ type: CLEAR_ERRORS });
};

// Update User (pentru asignarea vehiculelor)
export const updateUser = (userData) => {
  console.log('[AUTH] updateUser - Updating user with:', userData);
  return {
    type: USER_UPDATE,
    payload: userData
  };
};