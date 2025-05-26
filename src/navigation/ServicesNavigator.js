import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../utils/colors';

// Placeholder screens
import ServicesMenuScreen from '../screens/services/ServicesMenuScreen';

const Stack = createStackNavigator();

const ServicesNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="ServicesMenu" 
        component={ServicesMenuScreen}
        options={{ title: 'Servicii' }}
      />
    </Stack.Navigator>
  );
};

export default ServicesNavigator;