import AsyncStorage from '@react-native-async-storage/async-storage';

// Prefix pentru toate cheile din storage
const STORAGE_PREFIX = '@AmbuLife:';

// Salvează date în storage
export const saveToStorage = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(STORAGE_PREFIX + key, jsonValue);
    return true;
  } catch (error) {
    console.error('Eroare la salvarea în storage:', error);
    return false;
  }
};

// Citește date din storage
export const getFromStorage = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error('Eroare la citirea din storage:', error);
    return null;
  }
};

// Șterge date din storage
export const removeFromStorage = async (key) => {
  try {
    await AsyncStorage.removeItem(STORAGE_PREFIX + key);
    return true;
  } catch (error) {
    console.error('Eroare la ștergerea din storage:', error);
    return false;
  }
};

// Șterge toate datele din storage
export const clearStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ambuLifeKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    await AsyncStorage.multiRemove(ambuLifeKeys);
    return true;
  } catch (error) {
    console.error('Eroare la ștergerea storage-ului:', error);
    return false;
  }
};