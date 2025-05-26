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
  Image,
  Animated,
  FlatList
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import axios from '../../utils/axios';
import { colors } from '../../utils/colors';
import moment from 'moment';
import 'moment/locale/ro';

moment.locale('ro');

const CashFlowScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  
  const [cashFlows, setCashFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cities, setCities] = useState([]);
  const [privateServices, setPrivateServices] = useState([]);
  const [loadingPrivateServices, setLoadingPrivateServices] = useState(false);
  const [cashFlowStats, setCashFlowStats] = useState({
    income: { totalAmount: 0, count: 0 },
    expense: { totalAmount: 0, count: 0 },
    balance: 0
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
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
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Document states
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [datePickerField, setDatePickerField] = useState('');
  
  // Import data
  const [importData, setImportData] = useState({
    startDate: new Date(),
    endDate: new Date(),
    city: ''
  });
  
  // Form data
  const [formData, setFormData] = useState({
    date: new Date(),
    type: 'income',
    description: '',
    amount: '',
    paymentMethod: 'cash',
    cityId: '',
    notes: ''
  });

  const transactionTypes = [
    { value: 'income', label: 'Venit', icon: 'arrow-up', color: colors.success },
    { value: 'expense', label: 'Cheltuială', icon: 'arrow-down', color: colors.error }
  ];
  
  const paymentMethods = [
    { value: 'cash', label: 'Numerar', icon: 'cash' },
    { value: 'card', label: 'Card', icon: 'card' },
    { value: 'transfer', label: 'Transfer bancar', icon: 'swap-horizontal' },
    { value: 'other', label: 'Altă metodă', icon: 'wallet' }
  ];
  
  // Scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, -50],
    extrapolate: 'clamp'
  });
  
  // Fetch functions
  const fetchCashFlows = useCallback(async () => {
    try {
      const response = await axios.get('/cash-flow');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const recordsData = await Promise.all(response.data.data.map(async record => {
          // Format date
          const recordDate = new Date(record.date);
          const formattedDate = recordDate.toISOString().split('T')[0];
          
          // Extract city name and ID
          let cityName = 'Necunoscut';
          let cityId = null;
          
          if (record.city) {
            if (typeof record.city === 'object') {
              cityName = record.city.name || 'Necunoscut';
              cityId = record.city._id;
            } else if (typeof record.city === 'string') {
              cityId = record.city;
              const foundCity = cities.find(c => c._id === cityId);
              if (foundCity) {
                cityName = foundCity.name;
              }
            }
          }
          
          // Extract assistant name
          let assistantName = 'Nealocat';
          let assistantId = null;
          
          if (record.assistant) {
            if (typeof record.assistant === 'object') {
              assistantName = record.assistant.name || 'Nealocat';
              assistantId = record.assistant._id;
            } else if (typeof record.assistant === 'string') {
              assistantId = record.assistant;
              
              if (assistantId === user._id) {
                assistantName = user.name;
              } else {
                try {
                  const userResponse = await axios.get(`/users/${assistantId}`);
                  if (userResponse.data && userResponse.data.data) {
                    assistantName = userResponse.data.data.name || 'Asistent';
                  }
                } catch (error) {
                  console.error(`Nu s-a putut obține asistentul cu ID ${assistantId}:`, error);
                }
              }
            }
          }
          
          // Get info about transaction source (if from private service)
          let sourceDetails = null;
          if (record.sourceId && record.sourceModel === 'PrivateService') {
            if (typeof record.sourceId === 'object') {
              sourceDetails = {
                patientName: record.sourceId.patientName || 'Pacient',
                patientPhone: record.sourceId.patientPhone || 'Fără telefon',
                distance: record.sourceId.distance || 0
              };
            } else {
              try {
                const serviceResponse = await axios.get(`/private-services/${record.sourceId}`);
                if (serviceResponse.data && serviceResponse.data.data) {
                  sourceDetails = {
                    patientName: serviceResponse.data.data.patientName || 'Pacient',
                    patientPhone: serviceResponse.data.data.patientPhone || 'Fără telefon',
                    distance: serviceResponse.data.data.distance || 0
                  };
                }
              } catch (error) {
                console.error(`Nu s-a putut obține serviciul privat cu ID ${record.sourceId}:`, error);
              }
            }
          }
          
          return {
            _id: record._id,
            date: formattedDate,
            type: record.type,
            description: record.description,
            amount: record.amount,
            paymentMethod: record.paymentMethod,
            city: cityName,
            cityId,
            assistantName,
            assistantId,
            receiptImage: record.receiptImage,
            sourceId: record.sourceId,
            sourceModel: record.sourceModel,
            sourceDetails
          };
        }));
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
            
        const filteredRecords = isAdmin 
          ? recordsData 
          : recordsData.filter(record => record.cityId === userCityId);
        
        setCashFlows(filteredRecords);
      } else {
        setCashFlows([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Eroare la încărcarea înregistrărilor financiare:', err);
      setError(err.response?.data?.message || 'Nu s-au putut obține înregistrările');
      setCashFlows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isAdmin, cities]);

  const fetchCities = async () => {
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
          
          setImportData(prevData => ({
            ...prevData,
            city: userCityId
          }));
        }
      } else {
        setCities([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea orașelor:', err);
      setCities([]);
    }
  };

  const fetchCashFlowStats = async () => {
    try {
      // Add city filter if not admin
      let url = '/cash-flow/stats';
      
      // Add city filter
      if (cityFilter) {
        const cityObj = cities.find(c => c.name === cityFilter);
        if (cityObj) {
          url += `?city=${cityObj._id}`;
        }
      } else if (!isAdmin && user.city) {
        const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
        url += `?city=${userCityId}`;
      }
      
      // Add date filter if exists
      if (dateFilter) {
        const startOfDay = new Date(dateFilter);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(dateFilter);
        endOfDay.setHours(23, 59, 59, 999);
        
        url += url.includes('?') ? '&' : '?';
        url += `startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`;
      }
      
      const response = await axios.get(url);
      
      if (response.data && response.data.data) {
        setCashFlowStats(response.data.data);
      }
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor financiare:', err);
    }
  };

  const fetchPrivateServices = async (startDate, endDate, cityId) => {
    setLoadingPrivateServices(true);
    try {
      let url = '/private-services?';
      
      if (startDate) {
        url += `&startDate=${new Date(startDate).toISOString()}`;
      }
      
      if (endDate) {
        url += `&endDate=${new Date(endDate).toISOString()}`;
      }
      
      if (cityId) {
        url += `&city=${cityId}`;
      } else if (!isAdmin && user.city) {
        const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
        url += `&city=${userCityId}`;
      }
      
      const response = await axios.get(url);
      
      if (response.data && response.data.data) {
        setPrivateServices(response.data.data);
      } else {
        setPrivateServices([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea serviciilor private:', err);
      setPrivateServices([]);
    } finally {
      setLoadingPrivateServices(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCities();
      fetchCashFlowStats();
    }
  }, [user]);

  useEffect(() => {
    if (user && cities.length >= 0) {
      fetchCashFlows();
    }
  }, [user, cities, fetchCashFlows]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCashFlows();
    fetchCashFlowStats();
  };

  // Helper functions
  const formatDate = (dateString) => {
    return moment(dateString).format('DD MMMM YYYY');
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getFileIcon = (mimetype) => {
    if (!mimetype) return 'document';
    if (mimetype.includes('pdf')) return 'document-text';
    if (mimetype.includes('image')) return 'image';
    return 'document';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getTypeStyle = (type) => {
    if (type === 'income') {
      return { icon: 'arrow-up', color: colors.success, label: 'Venit' };
    } else {
      return { icon: 'arrow-down', color: colors.error, label: 'Cheltuială' };
    }
  };

  const getPaymentMethodDetails = (method) => {
    const methodObj = paymentMethods.find(m => m.value === method);
    return methodObj || { icon: 'wallet', label: 'Altă metodă' };
  };

  // Document handling
  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Este necesară permisiunea pentru cameră');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled) {
      setSelectedFile({
        uri: result.assets[0].uri,
        name: `IMG_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        setSelectedFile({
          uri: result.uri,
          name: result.name,
          type: result.mimeType || 'application/octet-stream',
        });
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const uploadReceipt = async (recordId) => {
    if (!selectedFile) {
      Alert.alert('Eroare', 'Vă rugăm să selectați un document');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('receipt', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.type,
      });

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await axios.post(
        `/cash-flow/${recordId}/upload-receipt`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.data && response.data.success) {
        Alert.alert('Succes', 'Documentul a fost încărcat cu succes!');
        setSelectedFile(null);
        
        // Reload record to get updated receipt
        if (currentRecord && currentRecord._id === recordId) {
          const recordResponse = await axios.get(`/cash-flow/${recordId}`);
          if (recordResponse.data && recordResponse.data.success) {
            const updatedRecord = recordResponse.data.data;
            setCurrentRecord({
              ...currentRecord,
              receiptImage: updatedRecord.receiptImage
            });
            
            // Update records list
            setCashFlows(prevRecords => 
              prevRecords.map(r => 
                r._id === recordId ? {
                  ...r,
                  receiptImage: updatedRecord.receiptImage
                } : r
              )
            );
          }
        }
      }
    } catch (err) {
      console.error('Eroare la încărcarea documentului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut încărca documentul');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handlers
  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleImportInputChange = (name, value) => {
    setImportData({
      ...importData,
      [name]: value
    });
    
    // Update list of private services when data changes
    if (name === 'startDate' || name === 'endDate' || name === 'city') {
      fetchPrivateServices(
        name === 'startDate' ? value : importData.startDate,
        name === 'endDate' ? value : importData.endDate,
        name === 'city' ? value : importData.city
      );
    }
  };

  const handleAddNewRecord = () => {
    const initialFormData = {
      date: new Date(),
      type: 'income',
      description: '',
      amount: '',
      paymentMethod: 'cash',
      cityId: '',
      notes: ''
    };
    
    if (!isAdmin && user.city) {
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      initialFormData.cityId = userCityId;
    }
    
    setFormData(initialFormData);
    setSelectedFile(null);
    setShowAddModal(true);
  };

  const handleShowImportModal = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setImportData({
      startDate: firstDayOfMonth,
      endDate: today,
      city: !isAdmin && user.city ? (typeof user.city === 'object' ? user.city._id : user.city) : ''
    });
    
    fetchPrivateServices(
      firstDayOfMonth,
      today,
      !isAdmin && user.city ? (typeof user.city === 'object' ? user.city._id : user.city) : null
    );
    
    setShowImportModal(true);
  };

  const handleViewRecord = (record) => {
    setCurrentRecord(record);
    setSelectedFile(null);
    setShowViewModal(true);
  };

  const handleEditInit = (record) => {
    setFormData({
      date: new Date(record.date),
      type: record.type,
      description: record.description,
      amount: record.amount.toString(),
      paymentMethod: record.paymentMethod,
      cityId: record.cityId,
      notes: record.notes || ''
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
      await axios.delete(`/cash-flow/${recordToDelete._id}`);
      
      setCashFlows(cashFlows.filter(r => r._id !== recordToDelete._id));
      
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
      
      Alert.alert('Succes', 'Tranzacția a fost ștearsă');
      fetchCashFlowStats();
    } catch (err) {
      console.error('Eroare la ștergere:', err);
      Alert.alert('Eroare', 'Nu s-a putut șterge tranzacția');
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.description.trim()) {
        Alert.alert('Eroare', 'Vă rugăm să adăugați o descriere!');
        return;
      }
      
      if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
        Alert.alert('Eroare', 'Suma trebuie să fie un număr pozitiv!');
        return;
      }
      
      const recordData = {
        type: formData.type,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date.toISOString(),
        paymentMethod: formData.paymentMethod,
        city: formData.cityId,
        notes: formData.notes
      };
      
      const response = await axios.post('/cash-flow', recordData);
      
      if (response.data && response.data.data) {
        const createdRecord = response.data.data;
        
        // Upload receipt after creating record, if a file is selected
        if (selectedFile) {
          await uploadReceipt(createdRecord._id);
        }
        
        Alert.alert('Succes', 'Tranzacția a fost adăugată cu succes!');
        setShowAddModal(false);
        fetchCashFlows();
        fetchCashFlowStats();
      }
      
    } catch (err) {
      console.error('Eroare la adăugare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga tranzacția');
    }
  };

  const handleEditSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.description.trim()) {
        Alert.alert('Eroare', 'Vă rugăm să adăugați o descriere!');
        return;
      }
      
      if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
        Alert.alert('Eroare', 'Suma trebuie să fie un număr pozitiv!');
        return;
      }
      
      const recordData = {
        type: formData.type,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date.toISOString(),
        paymentMethod: formData.paymentMethod,
        city: formData.cityId,
        notes: formData.notes
      };
      
      await axios.put(`/cash-flow/${recordToEdit._id}`, recordData);
      
      Alert.alert('Succes', 'Tranzacția a fost actualizată!');
      setShowEditModal(false);
      setRecordToEdit(null);
      fetchCashFlows();
      fetchCashFlowStats();
      
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza');
    }
  };

  const handleImportServices = async () => {
    try {
      if (!importData.startDate || !importData.endDate) {
        Alert.alert('Eroare', 'Vă rugăm să selectați perioada de import!');
        return;
      }
      
      const importPayload = {
        startDate: importData.startDate.toISOString(),
        endDate: importData.endDate.toISOString()
      };
      
      if (importData.city) {
        importPayload.city = importData.city;
      }
      
      const response = await axios.post('/cash-flow/import-from-private-services', importPayload);
      
      if (response.data && response.data.success) {
        Alert.alert('Succes', `${response.data.count} servicii private au fost importate cu succes.`);
        
        // Reload transactions list and stats
        fetchCashFlows();
        fetchCashFlowStats();
        setShowImportModal(false);
      } else {
        Alert.alert('Info', 'Nu există servicii care să poată fi importate pentru perioada selectată.');
      }
    } catch (err) {
      console.error('Eroare la importarea serviciilor private:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-au putut importa serviciile private');
    }
  };

  // Filtered records
  const filteredCashFlows = cashFlows.filter(record => {
    const matchesSearch = 
      searchTerm === '' || 
      (record.description && record.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCity = cityFilter === '' || record.city === cityFilter;
    
    const matchesDate = dateFilter === '' || 
      record.date === dateFilter;
    
    const matchesType = typeFilter === '' || record.type === typeFilter;
    
    const matchesPaymentMethod = paymentMethodFilter === '' || record.paymentMethod === paymentMethodFilter;
    
    return matchesSearch && matchesCity && matchesDate && matchesType && matchesPaymentMethod;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === 'asc' 
        ? dateA - dateB 
        : dateB - dateA;
    } else if (sortBy === 'amount') {
      return sortOrder === 'asc'
        ? a.amount - b.amount
        : b.amount - a.amount;
    } else if (sortBy === 'description') {
      return sortOrder === 'asc'
        ? a.description.localeCompare(b.description)
        : b.description.localeCompare(a.description);
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
            placeholder="Caută descriere..."
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
              <Text style={styles.filterLabel}>Tip:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={typeFilter}
                  onValueChange={setTypeFilter}
                  style={styles.picker}
                >
                  <Picker.Item label="Toate" value="" />
                  <Picker.Item label="Venituri" value="income" />
                  <Picker.Item label="Cheltuieli" value="expense" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Metodă plată:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={paymentMethodFilter}
                  onValueChange={setPaymentMethodFilter}
                  style={styles.picker}
                >
                  <Picker.Item label="Toate" value="" />
                  {paymentMethods.map(method => (
                    <Picker.Item key={method.value} label={method.label} value={method.value} />
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
                    <Picker.Item label="Sumă" value="amount" />
                    <Picker.Item label="Descriere" value="description" />
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
                setTypeFilter('');
                setPaymentMethodFilter('');
                setSortBy('date');
                setSortOrder('desc');
              }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.resetFiltersText}>Resetează filtre</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.importButton}
              onPress={handleShowImportModal}
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.importButtonText}>Importă din servicii</Text>
            </TouchableOpacity>
          </View>
      )}
    </Animated.View>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>
        <Ionicons name="wallet" size={18} color={colors.text} /> Situație Financiară
      </Text>
      
      <View style={styles.statsCards}>
        <View style={[styles.statCard, { backgroundColor: colors.success }]}>
          <View style={styles.statContent}>
            <View>
              <Text style={styles.statLabel}>Total Venituri</Text>
              <Text style={styles.statValue}>{formatAmount(cashFlowStats.income.totalAmount)}</Text>
              <Text style={styles.statDetail}>({cashFlowStats.income.count} tranzacții)</Text>
            </View>
            <Ionicons name="arrow-up" size={28} color="#fff" />
          </View>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.error }]}>
          <View style={styles.statContent}>
            <View>
              <Text style={styles.statLabel}>Total Cheltuieli</Text>
              <Text style={styles.statValue}>{formatAmount(cashFlowStats.expense.totalAmount)}</Text>
              <Text style={styles.statDetail}>({cashFlowStats.expense.count} tranzacții)</Text>
            </View>
            <Ionicons name="arrow-down" size={28} color="#fff" />
          </View>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: cashFlowStats.balance >= 0 ? colors.primary : colors.warning }]}>
          <View style={styles.statContent}>
            <View>
              <Text style={styles.statLabel}>Balanță</Text>
              <Text style={styles.statValue}>{formatAmount(cashFlowStats.balance)}</Text>
              <Text style={styles.statDetail}>&nbsp;</Text>
            </View>
            <Ionicons name="cash" size={28} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  );

  const renderRecord = ({ item }) => {
    const typeStyle = getTypeStyle(item.type);
    const paymentMethod = getPaymentMethodDetails(item.paymentMethod);
    const hasReceipt = !!item.receiptImage;
    
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
          <View style={[styles.typeBadge, { backgroundColor: typeStyle.color }]}>
            <Ionicons name={typeStyle.icon} size={14} color="#fff" />
            <Text style={styles.typeText}>{typeStyle.label}</Text>
          </View>
        </View>

        <View style={styles.recordBody}>
          <Text style={styles.descriptionText}>{item.description}</Text>
          <Text style={styles.amountText}>{formatAmount(item.amount)}</Text>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name={paymentMethod.icon} size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>{paymentMethod.label}</Text>
            </View>
            
            {item.sourceModel === 'PrivateService' && (
              <View style={styles.detailRow}>
                <Ionicons name="information-circle" size={14} color={colors.textSecondary} />
                <Text style={styles.detailText}>Import din serviciu privat</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.recordFooter}>
          <View style={styles.receiptIndicator}>
            {hasReceipt ? (
              <View style={styles.receiptBadge}>
                <Ionicons name="receipt" size={12} color="#fff" />
                <Text style={styles.receiptText}>Bon</Text>
              </View>
            ) : (
              <Text style={styles.noReceiptText}>Fără bon</Text>
            )}
          </View>

          <View style={styles.actionButtons}>
            {(isAdmin || item.assistantId === user._id) && (
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
            <Text style={styles.modalTitle}>Adaugă Tranzacție</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Tip tranzacție *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
                style={styles.picker}
              >
                {transactionTypes.map(type => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Data *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => {
                setDatePickerMode('date');
                setDatePickerField('date');
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>
                {moment(formData.date).format('DD.MM.YYYY')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Descriere *</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Descrieți tranzacția..."
              placeholderTextColor={colors.textSecondary}
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Sumă (RON) *</Text>
            <TextInput
              style={styles.input}
              value={formData.amount}
              onChangeText={(text) => handleInputChange('amount', text)}
              placeholder="Ex: 150.50"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Metodă de plată *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.paymentMethod}
                onValueChange={(value) => handleInputChange('paymentMethod', value)}
                style={styles.picker}
              >
                {paymentMethods.map(method => (
                  <Picker.Item key={method.value} label={method.label} value={method.value} />
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

            <Text style={styles.inputLabel}>Note (opțional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Note adiționale..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.documentSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="receipt" size={18} color={colors.primary} /> Bon fiscal
              </Text>
              
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={pickDocument}
                >
                  <Ionicons name="document" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Încarcă bon</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Fă o poză</Text>
                </TouchableOpacity>
              </View>

              {selectedFile && (
                <View style={styles.selectedDocument}>
                  <Ionicons 
                    name={getFileIcon(selectedFile.type)} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.selectedDocumentName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedFile(null)}>
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
            <Text style={styles.modalTitle}>Editează Tranzacție</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Tip tranzacție *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
                style={styles.picker}
              >
                {transactionTypes.map(type => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Data *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => {
                setDatePickerMode('date');
                setDatePickerField('date');
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.dateTimeText}>
                {moment(formData.date).format('DD.MM.YYYY')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Descriere *</Text>
            <TextInput
              style={styles.input}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              placeholder="Descrieți tranzacția..."
              placeholderTextColor={colors.textSecondary}
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Sumă (RON) *</Text>
            <TextInput
              style={styles.input}
              value={formData.amount}
              onChangeText={(text) => handleInputChange('amount', text)}
              placeholder="Ex: 150.50"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Metodă de plată *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.paymentMethod}
                onValueChange={(value) => handleInputChange('paymentMethod', value)}
                style={styles.picker}
              >
                {paymentMethods.map(method => (
                  <Picker.Item key={method.value} label={method.label} value={method.value} />
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

            <Text style={styles.inputLabel}>Note (opțional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Note adiționale..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Bonul fiscal poate fi gestionat din vizualizarea detaliată a tranzacției.
              </Text>
            </View>
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
            <Text style={styles.modalTitle}>Detalii Tranzacție</Text>
            <TouchableOpacity onPress={() => setShowViewModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {currentRecord && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informații Tranzacție</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{formatDate(currentRecord.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getTypeStyle(currentRecord.type).icon} 
                    size={18} 
                    color={getTypeStyle(currentRecord.type).color} 
                  />
                  <Text style={styles.detailText}>{getTypeStyle(currentRecord.type).label}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentRecord.description}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cash" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{formatAmount(currentRecord.amount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getPaymentMethodDetails(currentRecord.paymentMethod).icon} 
                    size={18} 
                    color={colors.textSecondary} 
                  />
                  <Text style={styles.detailText}>
                    {getPaymentMethodDetails(currentRecord.paymentMethod).label}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentRecord.city}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentRecord.assistantName}</Text>
                </View>
              </View>

              {currentRecord.sourceModel === 'PrivateService' && currentRecord.sourceDetails && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Import din Serviciu Privat</Text>
                  {currentRecord.sourceDetails.patientName && (
                    <View style={styles.detailRow}>
                      <Ionicons name="person" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Pacient:</Text> {currentRecord.sourceDetails.patientName}
                      </Text>
                    </View>
                  )}
                  {currentRecord.sourceDetails.patientPhone && (
                    <View style={styles.detailRow}>
                      <Ionicons name="call" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Telefon:</Text> {currentRecord.sourceDetails.patientPhone}
                      </Text>
                    </View>
                  )}
                  {currentRecord.sourceDetails.distance > 0 && (
                    <View style={styles.detailRow}>
                      <Ionicons name="car" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Distanță:</Text> {currentRecord.sourceDetails.distance} km
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {currentRecord.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Note</Text>
                  <Text style={styles.notesText}>{currentRecord.notes}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.detailSectionTitle}>Bon Fiscal</Text>
                  <View style={styles.documentActions}>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={pickDocument}
                    >
                      <Ionicons name="document" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={pickImage}
                    >
                      <Ionicons name="camera" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {selectedFile && (
                  <View style={styles.uploadProgress}>
                    <View style={styles.selectedDocument}>
                      <Ionicons 
                        name={getFileIcon(selectedFile.type)} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={styles.selectedDocumentName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                    </View>
                    <View style={styles.uploadActions}>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.primary }]}
                        onPress={() => uploadReceipt(currentRecord._id)}
                        disabled={isUploading}
                      >
                        <Text style={styles.uploadActionText}>
                          {isUploading ? 'Se încarcă...' : 'Încarcă'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.error }]}
                        onPress={() => setSelectedFile(null)}
                      >
                        <Ionicons name="trash" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    {isUploading && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                      </View>
                    )}
                  </View>
                )}

                {currentRecord.receiptImage ? (
                  <View style={styles.receiptContainer}>
                    <Image 
                      source={{ uri: `${axios.defaults.baseURL}/uploads/${currentRecord.receiptImage.replace(/^uploads\//, '')}` }}
                      style={styles.receiptImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.noReceipt}>
                    <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.noReceiptText}>
                      Nu există bon atașat
                    </Text>
                  </View>
                )}
              </View>
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
                Sunteți sigur că doriți să ștergeți tranzacția de tip <Text style={styles.boldText}>{getTypeStyle(recordToDelete.type).label}</Text> din data <Text style={styles.boldText}>{formatDate(recordToDelete.date)}</Text>, cu suma <Text style={styles.boldText}>{formatAmount(recordToDelete.amount)}</Text>?
              </Text>
              
              {recordToDelete.receiptImage && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={styles.warningText}>
                    Această tranzacție are un bon atașat care va fi șters permanent.
                  </Text>
                </View>
              )}
              
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
                  <Text style={styles.deleteButtonText}>Șterge tranzacție</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderImportModal = () => (
    <Modal
      visible={showImportModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowImportModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              <Ionicons name="download" size={20} color={colors.text} className="me-2" />
              Importă din Servicii Private
            </Text>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>De la data *</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => {
                  setDatePickerMode('startDate');
                  setDatePickerField('startDate');
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.dateTimeText}>
                  {moment(importData.startDate).format('DD.MM.YYYY')}
                </Text>
              </TouchableOpacity>
            </View>
            
           <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Până la data *</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => {
                  setDatePickerMode('endDate');
                  setDatePickerField('endDate');
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.dateTimeText}>
                  {moment(importData.endDate).format('DD.MM.YYYY')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {isAdmin && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Oraș</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={importData.city}
                    onValueChange={(value) => handleImportInputChange('city', value)}
                    style={styles.picker}
                    enabled={isAdmin}
                  >
                    <Picker.Item label="Toate orașele" value="" />
                    {cities.map(city => (
                      <Picker.Item key={city._id} label={city.name} value={city._id} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
            
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Vor fi importate doar serviciile private care nu au fost deja importate în sistem pentru perioada selectată.
              </Text>
            </View>
            
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                <Ionicons name="list" size={18} color={colors.text} /> 
                Servicii disponibile pentru import ({loadingPrivateServices ? '...' : privateServices.length})
              </Text>
            </View>
            
            {loadingPrivateServices ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Se încarcă serviciile...</Text>
              </View>
            ) : privateServices.length === 0 ? (
              <View style={styles.emptyServicesContainer}>
                <Ionicons name="information-circle" size={40} color={colors.warning} />
                <Text style={styles.emptyServicesText}>
                  Nu s-au găsit servicii pentru perioada selectată sau toate serviciile au fost deja importate.
                </Text>
              </View>
            ) : (
              <FlatList
                data={privateServices}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                  <View style={styles.serviceItem}>
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceDate}>{formatDate(item.date)}</Text>
                      <Text style={styles.serviceAmount}>{formatAmount(item.amount)}</Text>
                    </View>
                    <View style={styles.serviceDetails}>
                      <View style={styles.serviceDetail}>
                        <Ionicons name="person" size={14} color={colors.textSecondary} />
                        <Text style={styles.serviceDetailText}>{item.patientName || 'Necunoscut'}</Text>
                      </View>
                      <View style={styles.serviceDetail}>
                        <Ionicons name="call" size={14} color={colors.textSecondary} />
                        <Text style={styles.serviceDetailText}>{item.patientPhone || 'N/A'}</Text>
                      </View>
                      <View style={styles.serviceDetail}>
                        <Ionicons name="business" size={14} color={colors.textSecondary} />
                        <Text style={styles.serviceDetailText}>
                          {item.city && item.city.name ? item.city.name : 'Necunoscut'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                style={styles.servicesList}
              />
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowImportModal(false)}
            >
              <Text style={styles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.importActionButton]}
              onPress={handleImportServices}
              disabled={loadingPrivateServices || privateServices.length === 0}
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.importActionButtonText}>
                Importă ({privateServices.length})
              </Text>
            </TouchableOpacity>
          </View>
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchCashFlows}>
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
        {renderStats()}
        
        <View style={styles.recordsContainer}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="list" size={18} color={colors.text} /> Tranzacții ({filteredCashFlows.length})
          </Text>
          
          {filteredCashFlows.length > 0 ? (
            filteredCashFlows.map(record => renderRecord({ item: record }))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Nu există tranzacții</Text>
              <TouchableOpacity 
                style={styles.addFirstButton}
                onPress={handleAddNewRecord}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addFirstButtonText}>Adaugă prima tranzacție</Text>
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
      {renderImportModal()}
      
      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === 'filter' 
              ? (dateFilter ? new Date(dateFilter) : new Date()) 
              : datePickerMode === 'startDate'
                ? importData.startDate
                : datePickerMode === 'endDate'
                  ? importData.endDate
                  : formData.date
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              if (datePickerMode === 'filter') {
                setDateFilter(selectedDate.toISOString().split('T')[0]);
              } else if (datePickerMode === 'startDate') {
                handleImportInputChange('startDate', selectedDate);
              } else if (datePickerMode === 'endDate') {
                handleImportInputChange('endDate', selectedDate);
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
  
  // Stats
  statsContainer: {
    padding: 15,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  statsCards: {
    gap: 10,
  },
  statCard: {
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  statDetail: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  
  // Records
  recordsContainer: {
    padding: 15,
    backgroundColor: colors.card,
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
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  importButtonText: {
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
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  recordBody: {
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 5,
  },
  amountText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  detailsContainer: {
    marginTop: 5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailText: {
    marginLeft: 8,
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  detailLabel: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  receiptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  receiptText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  noReceiptText: {
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
  formGroup: {
    marginBottom: 15,
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
  textArea: {
    minHeight: 80,
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
  importActionButton: {
    backgroundColor: colors.info,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importActionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  
  // Document Section
  documentSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    marginLeft: 8,
    color: colors.primary,
    fontWeight: 'bold',
  },
  selectedDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  selectedDocumentName: {
    flex: 1,
    marginLeft: 10,
    color: colors.text,
  },
  
  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '20',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 15,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: colors.info,
    fontSize: 14,
  },
  
  // Detail Modal
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  notesText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Document Management in View Modal
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  documentActionButton: {
    padding: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
  },
  uploadProgress: {
    marginBottom: 15,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  uploadActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadActionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.inputBackground,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  receiptContainer: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  noReceipt: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    marginLeft: 10,
    color: colors.error,
    fontSize: 14,
    flex: 1,
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
  },
  
  // Import Modal Specific
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyServicesContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
  },
  emptyServicesText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  servicesList: {
    maxHeight: 300,
  },
  serviceItem: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serviceDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  serviceAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  serviceDetails: {
    gap: 5,
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDetailText: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.textSecondary,
  }
});

export default CashFlowScreen;