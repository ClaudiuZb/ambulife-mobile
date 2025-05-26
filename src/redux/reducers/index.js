import { combineReducers } from 'redux';
import authReducer from './authReducer';
import uiReducer from './uiReducer';
import userReducer from './userReducer';

export default combineReducers({
  auth: authReducer,
  ui: uiReducer,
  user: userReducer
});