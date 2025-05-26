import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../utils/colors';

const MechanicDashboardScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Mechanic Dashboard - În dezvoltare</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: {
    color: colors.text,
    fontSize: 18,
  },
});

export default MechanicDashboardScreen;