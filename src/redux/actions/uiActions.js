import { SET_ALERT, REMOVE_ALERT, SET_LOADING, CLEAR_LOADING } from './types';
import uuid from 'react-native-uuid';

// Set Alert
export const setAlert = (msg, type, timeout = 5000) => dispatch => {
  const id = uuid.v4();
  dispatch({
    type: SET_ALERT,
    payload: { msg, type, id }
  });

  setTimeout(() => dispatch({ type: REMOVE_ALERT, payload: id }), timeout);
};

// Set Loading
export const setLoading = () => dispatch => {
  dispatch({ type: SET_LOADING });
};

// Clear Loading
export const clearLoading = () => dispatch => {
  dispatch({ type: CLEAR_LOADING });
};
