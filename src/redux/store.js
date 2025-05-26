// src/redux/store.js
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import rootReducer from './reducers';

// Configurare pentru Redux Persist
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth'] // Persistă doar auth state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const middleware = [thunk];

// În React Native nu avem Redux DevTools Extension
const store = createStore(
  persistedReducer,
  applyMiddleware(...middleware)
);

export const persistor = persistStore(store);
export default store;