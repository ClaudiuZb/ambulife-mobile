// src/screens/medicaments/MedicamentsScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  FlatList
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import axios from '../../utils/axios';
import { colors } from '../../utils/colors';
import moment from 'moment';
import 'moment/locale/ro';

moment.locale('ro');

const MedicamentsScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  
  const [medicaments, setMedicaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  
  // Form data
  const [formData, setFormData] = useState({
    date: new Date(),
    vehicle: '',
    notes: '',
    cityId: '',
    status: 'pending'
  });

  const statusOptions = [
    { value: 'pending', label: 'În așteptare', icon: 'time', color: colors.warning },
    { value: 'approved', label: 'Aprobat', icon: 'checkmark-circle', color: colors.success },
    { value: 'rejected', label: 'Respins', icon: 'close-circle', color: colors.error }
  ];
  
  // Scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, -50],
    extrapolate: 'clamp'
  });
  
  useEffect(() => {
    if (user) {
      fetchVehicles();
      fetchCities();
    }
  }, [user]);
  
  useEffect(() => {
    if (user && vehicles.length >= 0) {
      fetchMedicaments();
    }
  }, [user, vehicles]);
  
  const fetchMedicaments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/medicaments');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        setMedicaments(response.data.data);
      } else {
        setMedicaments([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Eroare la încărcarea medicamentelor:', err);
      setError(err.response?.data?.message || 'Nu s-au putut obține înregistrările');
      setMedicaments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const fetchCities = async () => {
    setLoadingCities(true);
    try {
      const response = await axios.get('/cities');
      
      if (response.data && response.data.data) {
        setCities(response.data.data);
        
        if (!isAdmin && user.city) {
          const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
          setFormData(prevData => ({
            ...prevData,
            cityId: userCityId
          }));
        }
      } else {
        setCities([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea orașelor:', err);
      setCities([]);
    } finally {
      setLoadingCities(false);
    }
  };
  
  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const response = await axios.get('/vehicles');
      
      if (response.data && response.data.data) {
        const allVehicles = response.data.data;
        
        // Filtrează vehiculele pentru a afișa doar ambulanțele
        const ambulances = allVehicles.filter(vehicle => 
          vehicle.type === 'ambulance' || 
          vehicle.type.toLowerCase().includes('ambulanță') ||
          vehicle.type.toLowerCase().includes('ambulanta')
        );
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
        
        const filteredVehicles = isAdmin 
          ? ambulances 
          : ambulances.filter(vehicle => {
              const vehicleCityId = vehicle.city && typeof vehicle.city === 'object' 
                ? vehicle.city._id 
                : typeof vehicle.city === 'string' 
                  ? vehicle.city 
                  : null;
              return vehicleCityId === userCityId;
            });
        
        setVehicles(filteredVehicles);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea vehiculelor:', err);
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchMedicaments();
  };
  
  // Helper functions
  const formatDate = (dateString) => {
    return moment(dateString).format('DD MMMM YYYY');
  };
  
  const getStatusDetails = (status) => {
    const statusObj = statusOptions.find(s => s.value === status) || 
      { label: 'Necunoscut', icon: 'help-circle', color: colors.textSecondary };
    return statusObj;
  };
  
  // Handlers
  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleAddNewRecord = () => {
    const initialFormData = {
      date: new Date(),
      vehicle: '',
      notes: '',
      cityId: '',
      status: 'pending'
    };
    
    if (!isAdmin && user.city) {
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      initialFormData.cityId = userCityId;
    }
    
    setFormData(initialFormData);
    setShowAddModal(true);
  };
  
  const handleViewRecord = (record) => {
    setCurrentRecord(record);
    setShowViewModal(true);
  };
  
  const handleEditInit = (record) => {
    setFormData({
      date: new Date(record.date),
      vehicle: record.vehicle ? record.vehicle._id : '',
      notes: record.notes || '',
      cityId: record.city ? record.city._id : '',
      status: record.status
    });
    
    setRecordToEdit(record);
    setShowEditModal(true);
  };
  
  const handleDeleteInit = (record) => {
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`/medicaments/${recordToDelete._id}`);
      
      setMedicaments(medicaments.filter(r => r._id !== recordToDelete._id));
      
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
      
      Alert.alert('Succes', 'Înregistrarea a fost ștearsă');
    } catch (err) {
      console.error('Eroare la ștergere:', err);
      Alert.alert('Eroare', 'Nu s-a putut șterge înregistrarea');
      setShowDeleteConfirm(false);
    }
  };
  
  const handleSubmit = async () => {
    try {
      if (!formData.vehicle) {
        Alert.alert('Eroare', 'Vă rugăm să selectați o ambulanță!');
        return;
      }
      
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.notes.trim()) {
        Alert.alert('Eroare', 'Vă rugăm să adăugați detalii despre medicamente!');
        return;
      }
      
      const recordData = {
        date: formData.date.toISOString(),
        vehicle: formData.vehicle,
        notes: formData.notes,
        city: formData.cityId,
        status: formData.status
      };
      
      const response = await axios.post('/medicaments', recordData);
      
      if (response.data && response.data.data) {
        Alert.alert('Succes', 'Înregistrarea a fost adăugată cu succes!');
        setShowAddModal(false);
        fetchMedicaments();
      }
    } catch (err) {
      console.error('Eroare la adăugare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga înregistrarea');
    }
  };
  
  const handleEditSubmit = async () => {
    try {
      if (!formData.vehicle) {
        Alert.alert('Eroare', 'Vă rugăm să selectați o ambulanță!');
        return;
      }
      
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.notes.trim()) {
        Alert.alert('Eroare', 'Vă rugăm să adăugați detalii despre medicamente!');
        return;
      }
      
      const recordData = {
        date: formData.date.toISOString(),
        vehicle: formData.vehicle,
        notes: formData.notes,
        city: formData.cityId,
        status: formData.status
      };
      
      await axios.put(`/medicaments/${recordToEdit._id}`, recordData);
      
      Alert.alert('Succes', 'Înregistrarea a fost actualizată!');
      setShowEditModal(false);
      setRecordToEdit(null);
      fetchMedicaments();
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza');
    }
  };
  
  // Filtered records
  const filteredMedicaments = medicaments.filter(record => {
    const matchesSearch = 
      searchTerm === '' || 
      (record.notes && record.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCity = cityFilter === '' || (record.city && record.city.name === cityFilter);
    
    const matchesDate = dateFilter === '' || 
      (record.date && record.date.split('T')[0] === dateFilter);
    
    const matchesVehicle = vehicleFilter === '' || 
      (record.vehicle && record.vehicle._id === vehicleFilter);
    
    const matchesStatus = statusFilter === '' || record.status === statusFilter;
    
    return matchesSearch && matchesCity && matchesDate && matchesVehicle && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'asc' 
        ? dateA - dateB 
        : dateB - dateA;
    } else if (sortBy === 'vehicle') {
      const vehicleA = a.vehicle ? a.vehicle.plateNumber : '';
      const vehicleB = b.vehicle ? b.vehicle.plateNumber : '';
      return sortOrder === 'asc'
        ? vehicleA.localeCompare(vehicleB)
        : vehicleB.localeCompare(vehicleA);
    }
    return 0;
  });
  
  // Render functions
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerHeight }] }]}>
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Caută detalii medicamente..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name={showFilters ? "chevron-up" : "filter"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterOptions}>
          <View style={styles.filterRow}>
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Status:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={statusFilter}
                  onValueChange={setStatusFilter}
                  style={styles.picker}
                >
                  <Picker.Item label="Toate" value="" />
                  {statusOptions.map(status => (
                    <Picker.Item key={status.value} label={status.label} value={status.value} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Ambulanță:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={vehicleFilter}
                  onValueChange={setVehicleFilter}
                  style={styles.picker}
                >
                  <Picker.Item label="Toate" value="" />
                  {vehicles.map(vehicle => (
                    <Picker.Item key={vehicle._id} label={vehicle.plateNumber} value={vehicle._id} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.filterRow}>
            {isAdmin && (
              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Oraș:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={cityFilter}
                    onValueChange={setCityFilter}
                    style={styles.picker}
                  >
                    <Picker.Item label="Toate" value="" />
                    {cities.map(city => (
                      <Picker.Item key={city._id} label={city.name} value={city.name} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Data:</Text>
              <TouchableOpacity 
                style={styles.dateFilterButton}
                onPress={() => {
                  setDatePickerMode('filter');
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.dateFilterText}>
                  {dateFilter ? moment(dateFilter).format('DD.MM.YYYY') : 'Selectează data'}
                </Text>
                {dateFilter && (
                  <TouchableOpacity 
                    style={styles.clearDateButton}
                    onPress={() => setDateFilter('')}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Sortează după:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={sortBy}
                  onValueChange={setSortBy}
                  style={styles.picker}
                >
                  <Picker.Item label="Data" value="date" />
                  <Picker.Item label="Ambulanță" value="vehicle" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Ordine:</Text>
              <TouchableOpacity 
                style={styles.sortOrderButton}
                onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <Ionicons 
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={20} 
                  color={colors.primary} 
                />
                <Text style={styles.sortOrderText}>
                  {sortOrder === 'asc' ? 'Crescător' : 'Descrescător'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.resetFiltersButton}
            onPress={() => {
              setSearchTerm('');
              setCityFilter('');
              setDateFilter('');
              setVehicleFilter('');
              setStatusFilter('');
              setSortBy('date');
              setSortOrder('desc');
            }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.resetFiltersText}>Resetează filtre</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderRecord = ({ item }) => {
    const statusDetails = getStatusDetails(item.status);
    
    return (
      <TouchableOpacity 
        style={styles.recordCard}
        onPress={() => handleViewRecord(item)}
      >
        <View style={styles.recordHeader}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusDetails.color }]}>
            <Ionicons name={statusDetails.icon} size={14} color="#fff" />
            <Text style={styles.statusText}>{statusDetails.label}</Text>
          </View>
        </View>

        <View style={styles.recordBody}>
          <View style={styles.vehicleContainer}>
            <Ionicons name="car" size={16} color={colors.textSecondary} />
            <Text style={styles.vehicleText}>
              {item.vehicle ? item.vehicle.plateNumber : 'N/A'}
            </Text>
          </View>
          
          <Text style={styles.notesText} numberOfLines={2}>
            {item.notes}
          </Text>
        </View>

        <View style={styles.recordFooter}>
          <View style={styles.assistantContainer}>
            <Ionicons name="person" size={14} color={colors.textSecondary} />
            <Text style={styles.assistantText}>
              {item.assistant ? item.assistant.name : 'N/A'}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            {(isAdmin || (item.assistant && item.assistant._id === user._id)) && (
              <>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: colors.warning }]}
                  onPress={() => handleEditInit(item)}
                >
                  <Ionicons name="pencil" size={16} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: colors.error }]}
                  onPress={() => handleDeleteInit(item)}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderAddModal = () => (
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
            <Text style={styles.modalTitle}>Adaugă Medicament</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Data *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>
                {moment(formData.date).format('DD.MM.YYYY')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.vehicle}
                onValueChange={(value) => handleInputChange('vehicle', value)}
                style={styles.picker}
              >
                <Picker.Item label="Selectați o ambulanță" value="" />
                {vehicles.map(vehicle => (
                  <Picker.Item key={vehicle._id} label={vehicle.plateNumber} value={vehicle._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.cityId}
                onValueChange={(value) => handleInputChange('cityId', value)}
                style={styles.picker}
                enabled={isAdmin || !user.city}
              >
                <Picker.Item label="Selectați orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
                style={styles.picker}
              >
                {statusOptions.map(status => (
                  <Picker.Item key={status.value} label={status.label} value={status.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Detalii Medicamente *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Introduceți detalii despre medicamentele utilizate sau necesare..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={5}
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
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Salvează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  const renderEditModal = () => (
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
            <Text style={styles.modalTitle}>Editează Medicament</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Data *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => {
                setDatePickerMode('date');
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>
                {moment(formData.date).format('DD.MM.YYYY')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.vehicle}
                onValueChange={(value) => handleInputChange('vehicle', value)}
                style={styles.picker}
              >
                <Picker.Item label="Selectați o ambulanță" value="" />
                {vehicles.map(vehicle => (
                  <Picker.Item key={vehicle._id} label={vehicle.plateNumber} value={vehicle._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.cityId}
                onValueChange={(value) => handleInputChange('cityId', value)}
                style={styles.picker}
                enabled={isAdmin || !user.city}
              >
                <Picker.Item label="Selectați orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
                style={styles.picker}
              >
                {statusOptions.map(status => (
                  <Picker.Item key={status.value} label={status.label} value={status.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Detalii Medicamente *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Introduceți detalii despre medicamentele utilizate sau necesare..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={5}
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
              onPress={handleEditSubmit}
            >
              <Text style={styles.submitButtonText}>Salvează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  const renderViewModal = () => (
    <Modal
      visible={showViewModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowViewModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalii Medicament</Text>
            <TouchableOpacity onPress={() => setShowViewModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {currentRecord && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informații Generale</Text>
                <View style={styles.detailRow}>
                 <Ionicons name="calendar" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{formatDate(currentRecord.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="car" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {currentRecord.vehicle ? currentRecord.vehicle.plateNumber : 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {currentRecord.city ? currentRecord.city.name : 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {currentRecord.assistant ? currentRecord.assistant.name : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getStatusDetails(currentRecord.status).icon}
                    size={18} 
                    color={getStatusDetails(currentRecord.status).color} 
                  />
                  <Text style={[styles.detailText, { color: getStatusDetails(currentRecord.status).color }]}>
                    {getStatusDetails(currentRecord.status).label}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Detalii Medicamente</Text>
                <View style={styles.notesContainer}>
                  <Text style={styles.viewNotesText}>{currentRecord.notes}</Text>
                </View>
              </View>
              
              {(isAdmin || (currentRecord.assistant && currentRecord.assistant._id === user._id)) && (
                <View style={styles.actionContainer}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => {
                      setShowViewModal(false);
                      handleEditInit(currentRecord);
                    }}
                  >
                    <Ionicons name="pencil" size={18} color="#fff" />
                    <Text style={styles.editButtonText}>Editează</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
  
  const renderDeleteConfirmModal = () => (
    <Modal
      visible={showDeleteConfirm}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDeleteConfirm(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.confirmModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmare ștergere</Text>
          </View>
          
          {recordToDelete && (
            <View style={styles.modalBody}>
              <Text style={styles.confirmText}>
                Sunteți sigur că doriți să ștergeți înregistrarea din data <Text style={styles.boldText}>{formatDate(recordToDelete.date)}</Text> pentru ambulanța <Text style={styles.boldText}>{recordToDelete.vehicle ? recordToDelete.vehicle.plateNumber : 'N/A'}</Text>?
              </Text>
              
              <View style={styles.confirmButtons}>
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.cancelButton]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.cancelButtonText}>Anulează</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, styles.deleteButton]}
                  onPress={handleDeleteConfirm}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={styles.deleteButtonText}>Șterge</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă datele...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchMedicaments}>
          <Text style={styles.retryButtonText}>Reîncearcă</Text>
        </TouchableOpacity>
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
          // Update the scrollY value with the current scroll position
          const offsetY = event.nativeEvent.contentOffset.y;
          scrollY.setValue(offsetY);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.recordsContainer}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="medkit" size={18} color={colors.text} /> Evidență Medicamente ({filteredMedicaments.length})
          </Text>
          
          {filteredMedicaments.length > 0 ? (
            filteredMedicaments.map(record => renderRecord({ item: record }))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="medkit-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Nu există înregistrări de medicamente</Text>
              <TouchableOpacity 
                style={styles.addFirstButton}
                onPress={handleAddNewRecord}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addFirstButtonText}>Adaugă prima înregistrare</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddNewRecord}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {renderAddModal()}
      {renderEditModal()}
      {renderViewModal()}
      {renderDeleteConfirmModal()}
      
      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === 'filter' 
              ? (dateFilter ? new Date(dateFilter) : new Date()) 
              : formData.date
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (datePickerMode === 'filter') {
                setDateFilter(selectedDate.toISOString().split('T')[0]);
              } else {
                handleInputChange('date', selectedDate);
              }
            }
          }}
        />
      )}
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
  errorText: {
    marginTop: 10,
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Header
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    color: colors.text,
    fontSize: 16,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Scrollable content
  scrollView: {
    flex: 1,
  },
  
  // Records
  recordsContainer: {
    padding: 15,
    backgroundColor: colors.card,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  
  // Filter options
  filterOptions: {
    marginTop: 10,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 12,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  filterColumn: {
    flex: 1,
  },
  filterLabel: {
    color: colors.textSecondary,
    marginBottom: 5,
    fontSize: 14,
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  picker: {
    color: colors.text,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  dateFilterText: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  clearDateButton: {
    padding: 4,
  },
  sortOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  sortOrderText: {
    marginLeft: 5,
    color: colors.text,
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  resetFiltersText: {
    marginLeft: 5,
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Record Card
  recordCard: {
    backgroundColor: colors.background,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  recordBody: {
    marginBottom: 10,
  },
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleText: {
    marginLeft: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  notesText: {
    color: colors.text,
    fontSize: 14,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  assistantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    color: colors.textSecondary,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addFirstButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  
  // FAB
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
  
  // Modal
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
  confirmModalContent: {
    backgroundColor: colors.card,
    borderRadius: 15,
    marginHorizontal: 20,
    maxHeight: '90%',
    marginTop: 'auto',
    marginBottom: 'auto',
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
  
  // Form
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 15,
  },
  dateTimeText: {
    marginLeft: 10,
    color: colors.text,
    fontSize: 16,
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
  },
  
  // Detail Section
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    marginLeft: 8,
    color: colors.text,
    fontSize: 15,
  },
  notesContainer: {
    backgroundColor: colors.inputBackground,
    padding: 15,
    borderRadius: 10,
  },
  viewNotesText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  
  // Action Container in View Modal
  actionContainer: {
    marginTop: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    padding: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Confirm Modal
  confirmText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: 'bold',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  }
});

export default MedicamentsScreen;