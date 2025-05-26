import { SET_ALERT, REMOVE_ALERT, SET_LOADING, CLEAR_LOADING } from '../actions/types';

const initialState = {
  alerts: [],
  loading: false
};

export default function uiReducer(state = initialState, action) {
  switch (action.type) {
    case SET_ALERT:
      return {
        ...state,
        alerts: [...state.alerts, action.payload]
      };
    case REMOVE_ALERT:
      return {
        ...state,
        alerts: state.alerts.filter(alert => alert.id !== action.payload)
      };
    case SET_LOADING:
      return {
        ...state,
        loading: true
      };
    case CLEAR_LOADING:
      return {
        ...state,
        loading: false
      };
    default:
      return state;
  }
}