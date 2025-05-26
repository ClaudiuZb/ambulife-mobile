import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../utils/colors';

// Placeholder screen
import ManagementMenuScreen from '../screens/management/ManagementMenuScreen';

const Stack = createStackNavigator();

const ManagementNavigator = () => {
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
        name="ManagementMenu" 
        component={ManagementMenuScreen}
        options={{ title: 'Gestiune' }}
      />
    </Stack.Navigator>
  );
};

export default ManagementNavigator;