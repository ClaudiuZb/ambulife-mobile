import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { colors } from '../../utils/colors';

// Importăm dashboard-urile pentru fiecare rol
import AdminDashboardScreen from '../dashboards/AdminDashboardScreen';
import AssistantDashboardScreen from '../dashboards/AssistantDashboardScreen';
import MechanicDashboardScreen from '../dashboards/MechanicDashboardScreen';

const DashboardScreen = () => {
  const { user, loading } = useSelector(state => state.auth);
  
  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă...</Text>
      </View>
    );
  }
  
  // Render dashboard based on user role
  const renderDashboard = () => {
    switch (user.role) {
      case 'admin':
        return <AdminDashboardScreen />;
      case 'assistant':
        return <AssistantDashboardScreen />;
      case 'mechanic':
        return <MechanicDashboardScreen />;
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Dashboard nedisponibil pentru rolul dvs.</Text>
          </View>
        );
    }
  };
  
  return renderDashboard();
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  },
  loadingText: {
    color: colors.text,
    marginTop: 10,
    fontSize: 16
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center'
  }
});

export default DashboardScreen;