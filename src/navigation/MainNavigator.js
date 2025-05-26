import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { colors } from '../utils/colors';
import { logout } from '../redux/actions/authActions';
import socketService from '../services/socket';

// Screens - CONSTRUITE
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import PrivateBookingsScreen from '../screens/services/PrivateBookingsScreen';
import CNASBookingsScreen from '../screens/services/CNASBookingsScreen';
import PNCCBookingsScreen from '../screens/services/PNCCBookingsScreen';
import EventsScreen from '../screens/services/EventsScreen';
import FuelScreen from '../screens/management/FuelScreen';
import CashFlowScreen from '../screens/management/CashFlowScreen';
import MedicamentsScreen from '../screens/management/MedicamentsScreen';
import UsersScreen from '../screens/management/UsersScreen';
import AmbulanceServiceScreen from '../screens/management/AmbulanceServiceScreen';
import TrackingScreen from '../screens/tracking/TrackingScreen';
import ChatScreen from '../screens/chat/ChatScreen';

// Helper function pentru a verifica dacă un utilizator poate accesa Tracking
const canAccessTracking = (user) => {
  return user?.role === 'admin' || user?.role === 'assistant';
};

// Placeholder Screen temporar pentru ecranele neconstruite
const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <Ionicons name="construct" size={64} color={colors.textSecondary} />
    <Text style={{ color: colors.text, fontSize: 18, marginTop: 20 }}>{route.name}</Text>
    <Text style={{ color: colors.textSecondary, marginTop: 10 }}>În dezvoltare...</Text>
  </View>
);

const Drawer = createDrawerNavigator();

// Custom Drawer Content
function CustomDrawerContent(props) {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  const handleLogout = () => {
    props.navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
    
    socketService.disconnect();
    
    setTimeout(() => {
      dispatch(logout());
    }, 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContentContainer}>
        {/* Header */}
        <View style={styles.drawerHeader}>
          <Ionicons name="medical" size={50} color={colors.primary} />
          <Text style={styles.appName}>Ambu-Life</Text>
          <Text style={styles.userName}>{user?.name || 'Utilizator'}</Text>
          <Text style={styles.userRole}>
            {user?.role === 'admin' ? 'Administrator' : 
             user?.role === 'mechanic' ? 'Mecanic' : 'Asistent Medical'}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.drawerSection}>
          <Text style={styles.sectionTitle}>GENERAL</Text>
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="home-outline" size={size} color={colors.text} />}
            label="Dashboard"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('Dashboard')}
          />
          
          {canAccessTracking(user) && (
            <DrawerItem
              icon={({ size }) => <Ionicons name="map-outline" size={size} color={colors.text} />}
              label="Tracking"
              labelStyle={styles.drawerLabel}
              onPress={() => props.navigation.navigate('Tracking')}
            />
          )}
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="chatbubbles-outline" size={size} color={colors.text} />}
            label="Chat 🚧"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('Chat')}
          />
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.sectionTitle}>SERVICII</Text>
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="person-outline" size={size} color={colors.text} />}
            label="Servicii Private"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('PrivateBookings')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="medical-outline" size={size} color={colors.text} />}
            label="Servicii CNAS"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('CNASBookings')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="medkit-outline" size={size} color={colors.text} />}
            label="Servicii PNCC"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('PNCCBookings')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="calendar-outline" size={size} color={colors.text} />}
            label="Evenimente"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('Events')}
          />
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.sectionTitle}>MANAGEMENT</Text>
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="car-sport-outline" size={size} color={colors.text} />}
            label="Carburant"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('Fuel')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="cash-outline" size={size} color={colors.text} />}
            label="Cash Flow"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('CashFlow')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="fitness-outline" size={size} color={colors.text} />}
            label="Medicamente"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('Medicaments')}
          />
          
          <DrawerItem
            icon={({ size }) => <Ionicons name="construct-outline" size={size} color={colors.text} />}
            label="Service Amb"
            labelStyle={styles.drawerLabel}
            onPress={() => props.navigation.navigate('AmbulanceService')}
          />
          
          {user?.role === 'admin' && (
            <DrawerItem
              icon={({ size }) => <Ionicons name="people-outline" size={size} color={colors.text} />}
              label="Utilizatori"
              labelStyle={styles.drawerLabel}
              onPress={() => props.navigation.navigate('Users')}
            />
          )}
        </View>
        
        {/* Logout Button - Acum este inclus în DrawerContentScrollView */}
        <View style={styles.logoutSection}>
          <DrawerItem
            icon={({ size }) => <Ionicons name="log-out-outline" size={size} color={colors.error} />}
            label="Deconectare"
            labelStyle={styles.logoutText}
            onPress={handleLogout}
          />
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

const MainNavigator = () => {
  const { user } = useSelector(state => state.auth);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          elevation: 4,
          shadowOpacity: 0.3,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: colors.background,
          width: 280,
        },
      }}
    >
      {/* ECRANE CONSTRUITE */}
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      
      <Drawer.Screen 
        name="PrivateBookings" 
        component={PrivateBookingsScreen}
        options={{ title: 'Servicii Private' }}
      />

      {/* ECRANE DE CONSTRUIT - Folosim PlaceholderScreen temporar */}
      {canAccessTracking(user) && (
        <Drawer.Screen 
          name="Tracking" 
          component={TrackingScreen}
          options={{ title: 'Tracking Flotă' }}
        />
      )}
      
      <Drawer.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      
      <Drawer.Screen 
        name="CNASBookings" 
        component={CNASBookingsScreen}
        options={{ title: 'Servicii CNAS' }}
      />
      
      <Drawer.Screen 
        name="PNCCBookings" 
        component={PNCCBookingsScreen}
        options={{ title: 'Servicii PNCC' }}
      />
      
      <Drawer.Screen 
        name="Events" 
        component={EventsScreen}
        options={{ title: 'Evenimente' }}
      />
      
      <Drawer.Screen 
        name="Fuel" 
        component={FuelScreen}
        options={{ title: 'Carburant' }}
      />
      
      <Drawer.Screen 
        name="CashFlow" 
        component={CashFlowScreen}
        options={{ title: 'Cash Flow' }}
      />
      
      <Drawer.Screen 
        name="Medicaments" 
        component={MedicamentsScreen}
        options={{ title: 'Evidentă Medicamente' }}
      />
      
      <Drawer.Screen 
        name="AmbulanceService" 
        component={AmbulanceServiceScreen}
        options={{ title: 'Service Ambulanțe' }}
      />
      
      {user?.role === 'admin' && (
        <Drawer.Screen 
          name="Users" 
          component={UsersScreen}
          options={{ title: 'Utilizatori' }}
        />
      )}
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerContentContainer: {
    paddingBottom: 20, // Asigură un spațiu la sfârșitul conținutului scrollabil
  },
  drawerHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginBottom: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 10,
  },
  userName: {
    fontSize: 18,
    color: colors.text,
    marginTop: 10,
  },
  userRole: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 5,
  },
  drawerSection: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: 'bold',
    marginLeft: 15,
    marginBottom: 5,
    marginTop: 10,
  },
  drawerLabel: {
    color: colors.text,
    fontSize: 16,
  },
  logoutSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 15,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MainNavigator;