import {
  GET_USERS,
  GET_USER,
  ADD_USER,
  UPDATE_USER_ADMIN,
  DELETE_USER,
  USERS_ERROR,
  SET_LOADING_USERS,
  CLEAR_USER
} from '../actions/types';

const initialState = {
  users: [],
  user: null,
  loading: false,
  error: null
};

export default function userReducer(state = initialState, action) {
  switch (action.type) {
    case GET_USERS:
      return {
        ...state,
        users: action.payload,
        loading: false
      };
    case GET_USER:
      return {
        ...state,
        user: action.payload,
        loading: false
      };
    case ADD_USER:
      return {
        ...state,
        users: [...state.users, action.payload],
        loading: false
      };
    case UPDATE_USER_ADMIN:
      return {
        ...state,
        users: state.users.map(user =>
          user._id === action.payload._id ? action.payload : user
        ),
        user: action.payload,
        loading: false
      };
    case DELETE_USER:
      return {
        ...state,
        users: state.users.filter(user => user._id !== action.payload),
        loading: false
      };
    case SET_LOADING_USERS:
      return {
        ...state,
        loading: true
      };
    case USERS_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    case CLEAR_USER:
      return {
        ...state,
        user: null
      };
    default:
      return state;
  }
}