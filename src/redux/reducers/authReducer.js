import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  USER_LOADING,
  USER_LOADED,
  AUTH_ERROR,
  LOGIN_SUCCESS,
  LOGIN_FAIL,
  LOGOUT,
  CLEAR_ERRORS,
  USER_UPDATE
} from '../actions/types';

const initialState = {
  token: null, // În React Native, vom obține token-ul din AsyncStorage prin Redux Persist
  isAuthenticated: null,
  loading: false,
  user: null,
  error: null
};

export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case USER_LOADING:
      return {
        ...state,
        loading: true
      };
    case USER_LOADED:
      return {
        ...state,
        isAuthenticated: true,
        loading: false,
        user: action.payload
      };
    case LOGIN_SUCCESS:
      return {
        ...state,
        ...action.payload,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case AUTH_ERROR:
    case LOGIN_FAIL:
      // În React Native, AsyncStorage se gestionează în acțiuni
      return {
        ...state,
        token: null,
        isAuthenticated: false,
        loading: false,
        user: { city: null, role: null },
        error: action.payload
      };
    case LOGOUT:
      // În React Native, AsyncStorage se gestionează în acțiuni
      return {
        ...state,
        token: null,
        isAuthenticated: false,
        loading: false,
        user: { city: null, role: null },
        error: null
      };
    case CLEAR_ERRORS:
      return {
        ...state,
        error: null
      };
    case USER_UPDATE:
      console.log('============ USER_UPDATE REDUCER ============');
      console.log('Current state:', state);
      console.log('Action payload:', action.payload);
      
      return {
        ...state,
        user: action.payload,
        loading: false
      };
    default:
      return state;
  }
}