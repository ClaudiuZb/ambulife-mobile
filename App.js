import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';

import store, { persistor } from './src/redux/store';
import AppNavigator from './src/navigation/AppNavigator';
import socketService from './src/services/socket';
import LoadingScreen from './src/screens/LoadingScreen';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  useEffect(() => {
    // Request permissions
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    
    requestPermissions();
    
    // Connect socket when app starts
    const connectSocket = async () => {
      const state = store.getState();
      if (state.auth.isAuthenticated) {
        await socketService.connect();
      }
    };
    
    connectSocket();
    
    // Cleanup
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
          <Toast />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}