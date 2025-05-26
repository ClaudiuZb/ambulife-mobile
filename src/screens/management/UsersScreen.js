// src/screens/users/UsersScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../../utils/colors';
import { getUsers, deleteUser, addUser, updateUser, getUser, clearUser } from '../../redux/actions/userActions';
import axios from '../../utils/axios';

const UsersScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { users, user, loading } = useSelector(state => state.user);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for user management
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'assistant',
    city: '',
    phone: ''
  });
  
  // Scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, -50],
    extrapolate: 'clamp'
  });
  
  const fetchUsers = useCallback(() => {
    dispatch(getUsers());
  }, [dispatch]);
  
  const fetchCities = useCallback(async () => {
    setLoadingCities(true);
    try {
      const response = await axios.get('/cities');
      if (response.data && response.data.data) {
        setCities(response.data.data);
      }
    } catch (err) {
      console.error('Eroare la încărcarea orașelor:', err);
    } finally {
      setLoadingCities(false);
    }
  }, []);
  
  useEffect(() => {
    fetchUsers();
    fetchCities();
    
    // Cleanup
    return () => {
      dispatch(clearUser());
    };
  }, [fetchUsers, fetchCities, dispatch]);
  
  // Set form data when editing a user
  useEffect(() => {
    if (showEditModal && userToEdit) {
      setFormData({
        name: userToEdit.name || '',
        email: userToEdit.email || '',
        password: '', // Password field should be empty in edit mode
        role: userToEdit.role || 'assistant',
        city: userToEdit.city?._id || '',
        phone: userToEdit.phone || ''
      });
    }
  }, [showEditModal, userToEdit]);
  
  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchUsers(), fetchCities()])
      .then(() => setRefreshing(false))
      .catch(() => setRefreshing(false));
  };
  
  const handleAddUser = () => {
    // Reset form for adding a new user
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'assistant',
      city: '',
      phone: ''
    });
    setShowAddModal(true);
  };
  
  const handleEditUser = (user) => {
    setUserToEdit(user);
    setShowEditModal(true);
  };
  
  const handleDeleteUser = (user) => {
    Alert.alert(
      "Confirmare ștergere",
      `Ești sigur că vrei să ștergi utilizatorul ${user.name}?`,
      [
        {
          text: "Anulează",
          style: "cancel"
        },
        { 
          text: "Șterge", 
          onPress: () => {
            dispatch(deleteUser(user._id));
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmitAdd = async () => {
    try {
      if (!formData.name || !formData.email || !formData.password) {
        Alert.alert('Eroare', 'Vă rugăm să completați toate câmpurile obligatorii!');
        return;
      }
      
      if (formData.role !== 'admin' && !formData.city) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș pentru acest utilizator!');
        return;
      }
      
      await dispatch(addUser(formData));
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga utilizatorul');
    }
  };
  
  const handleSubmitEdit = async () => {
    try {
      if (!formData.name || !formData.email) {
        Alert.alert('Eroare', 'Vă rugăm să completați toate câmpurile obligatorii!');
        return;
      }
      
      if (formData.role !== 'admin' && !formData.city) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș pentru acest utilizator!');
        return;
      }
      
      // Create a copy of formData without password if it's empty
      const updatedData = { ...formData };
      if (!updatedData.password) delete updatedData.password;
      
      await dispatch(updateUser(userToEdit._id, updatedData));
      setShowEditModal(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza utilizatorul');
    }
  };
  
  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return "shield";
      case 'assistant':
        return "medkit";
      case 'mechanic':
        return "construct";
      default:
        return "person";
    }
  };
  
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return colors.primary;
      case 'assistant':
        return colors.info;
      case 'mechanic':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };
  
  const getRoleName = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'assistant':
        return 'Asistent Medical';
      case 'mechanic':
        return 'Mecanic';
      default:
        return 'Necunoscut';
    }
  };
  
  // Render functions
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerHeight }] }]}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Gestionare Utilizatori</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddUser}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
  
  const renderUserCard = (user) => (
    <View style={styles.userCard} key={user._id}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.roleIconContainer, { backgroundColor: getRoleColor(user.role) }]}>
            <Ionicons name={getRoleIcon(user.role)} size={18} color="#fff" />
          </View>
          <Text style={styles.userName}>{user.name}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleName(user.role)}</Text>
        </View>
      </View>
      
      <View style={styles.userDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{user.email}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{user.city ? user.city.name : 'Global'}</Text>
        </View>
        
        {user.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{user.phone}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEditUser(user)}
        >
          <Ionicons name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(user)}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
          <Text style={styles.deleteButtonText}>Șterge</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderAddUserModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adaugă Utilizator</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume Complet *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Numele și prenumele utilizatorului"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="email@exemplu.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Parolă *</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              placeholder="Parolă"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Rol *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
                style={styles.picker}
              >
                <Picker.Item label="Administrator" value="admin" />
                <Picker.Item label="Asistent Medical" value="assistant" />
                <Picker.Item label="Mecanic" value="mechanic" />
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș {formData.role !== 'admin' ? '*' : ''}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.city}
                onValueChange={(value) => handleInputChange('city', value)}
                style={styles.picker}
                enabled={formData.role !== 'admin'}
              >
                <Picker.Item label="Selectează orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>
            
            {formData.role === 'admin' && (
              <Text style={styles.helperText}>
                Administratorii au acces global, nu necesită un oraș.
              </Text>
            )}

            <Text style={styles.inputLabel}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              placeholder="Număr de telefon"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.submitButton]}
              onPress={handleSubmitAdd}
            >
              <Text style={styles.submitButtonText}>Adaugă</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  const renderEditUserModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editează Utilizator</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume Complet *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Numele și prenumele utilizatorului"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="email@exemplu.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Parolă (lăsați gol pentru a păstra parola actuală)</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              placeholder="Parolă nouă"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Rol *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
                style={styles.picker}
              >
                <Picker.Item label="Administrator" value="admin" />
                <Picker.Item label="Asistent Medical" value="assistant" />
                <Picker.Item label="Mecanic" value="mechanic" />
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș {formData.role !== 'admin' ? '*' : ''}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.city}
                onValueChange={(value) => handleInputChange('city', value)}
                style={styles.picker}
                enabled={formData.role !== 'admin'}
              >
                <Picker.Item label="Selectează orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>
            
            {formData.role === 'admin' && (
              <Text style={styles.helperText}>
                Administratorii au acces global, nu necesită un oraș.
              </Text>
            )}

            <Text style={styles.inputLabel}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              placeholder="Număr de telefon"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.submitButton]}
              onPress={handleSubmitEdit}
            >
              <Text style={styles.submitButtonText}>Salvează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă utilizatorii...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          scrollY.setValue(offsetY);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.contentContainer}>
          {users && users.length > 0 ? (
            users.map(user => renderUserCard(user))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Nu există utilizatori</Text>
              <TouchableOpacity 
                style={styles.addFirstButton}
                onPress={handleAddUser}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addFirstButtonText}>Adaugă primul utilizator</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddUser}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      
      {renderAddUserModal()}
      {renderEditUserModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
  },
  headerContainer: {
    backgroundColor: colors.card,
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingBottom: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    elevation: 3,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
  },
  roleText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  userDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    marginLeft: 8,
    color: colors.text,
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
  },
  editButton: {
    borderColor: colors.primary,
  },
  editButtonText: {
    marginLeft: 6,
    color: colors.primary,
    fontSize: 14,
  },
  deleteButton: {
    borderColor: colors.error,
  },
  deleteButtonText: {
    marginLeft: 6,
    color: colors.error,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addFirstButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 15,
    color: colors.text,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 5,
    fontStyle: 'italic',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.inputBackground,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});

export default UsersScreen;