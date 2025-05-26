import { Platform, Alert, Linking } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings
} from 'react-native-permissions';

// Permisiuni necesare pentru aplicație
const PLATFORM_PERMISSIONS = Platform.select({
  android: {
    camera: PERMISSIONS.ANDROID.CAMERA,
    location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    backgroundLocation: PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
    storage: PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    notifications: PERMISSIONS.ANDROID.POST_NOTIFICATIONS
  },
  ios: {
    camera: PERMISSIONS.IOS.CAMERA,
    location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    backgroundLocation: PERMISSIONS.IOS.LOCATION_ALWAYS,
    storage: PERMISSIONS.IOS.PHOTO_LIBRARY,
    notifications: PERMISSIONS.IOS.NOTIFICATIONS
  }
});

// Verifică și solicită o permisiune
export const checkAndRequestPermission = async (permission) => {
  try {
    const result = await check(PLATFORM_PERMISSIONS[permission]);
    
    switch (result) {
      case RESULTS.UNAVAILABLE:
        console.log('Această funcționalitate nu este disponibilă pe dispozitivul tău');
        return false;
        
      case RESULTS.DENIED:
        const requestResult = await request(PLATFORM_PERMISSIONS[permission]);
        return requestResult === RESULTS.GRANTED;
        
      case RESULTS.GRANTED:
        return true;
        
      case RESULTS.BLOCKED:
        Alert.alert(
          'Permisiune necesară',
          `Pentru a utiliza această funcționalitate, trebuie să activezi permisiunea din setările aplicației.`,
          [
            { text: 'Anulează', style: 'cancel' },
            { text: 'Deschide Setări', onPress: openSettings }
          ]
        );
        return false;
    }
  } catch (error) {
    console.error('Eroare la verificarea permisiunii:', error);
    return false;
  }
};

// Verifică toate permisiunile necesare la pornire
export const checkAllPermissions = async () => {
  const permissions = ['location', 'camera', 'notifications'];
  const results = {};
  
  for (const permission of permissions) {
    results[permission] = await checkAndRequestPermission(permission);
  }
  
  return results;
};