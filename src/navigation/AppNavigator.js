import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen'; // Expo splash screen
import { loadUser } from '../redux/actions/authActions';
import { colors } from '../utils/colors';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import MainNavigator from './MainNavigator';
import MechanicNavigator from './MechanicNavigator';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator();

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const AppNavigator = () => {
  const { isAuthenticated, loading, user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  
  useEffect(() => {
    // Load user and hide splash
    const prepare = async () => {
      try {
        await dispatch(loadUser());
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };
    
    prepare();
  }, []);
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background }
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user?.role === 'mechanic' ? (
          <Stack.Screen name="MechanicDashboard" component={MechanicNavigator} />
        ) : (
          <Stack.Screen name="MainApp" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
