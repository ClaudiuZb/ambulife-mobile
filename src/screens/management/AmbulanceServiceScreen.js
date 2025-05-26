// src/screens/services/AmbulanceServiceScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
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

const AmbulanceServiceScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  const isMechanic = user && user.role === 'mechanic';
  
  const [serviceRecords, setServiceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [cities, setCities] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [serviceStats, setServiceStats] = useState({
    pending: 0,
    'in-progress': 0,
    completed: 0,
    cancelled: 0,
    critical: 0,
    total: 0
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [currentRecord, setCurrentRecord] = useState(null);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [recordToAssign, setRecordToAssign] = useState(null);
  const [recordToUpdateStatus, setRecordToUpdateStatus] = useState(null);
  
  // Document states
  const [selectedProblemFile, setSelectedProblemFile] = useState(null);
  const [selectedReceiptFile, setSelectedReceiptFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeImageType, setActiveImageType] = useState(null);
  
  const [formData, setFormData] = useState({
    vehicle: '',
    title: '',
    description: '',
    km: '',
    status: 'pending',
    partsReplaced: '',
    partsCost: 0,
    nextServiceKm: '',
    notes: '',
    cityId: '',
    assignedTo: ''
  });

  const serviceStatusTypes = [
    { value: 'pending', label: 'În așteptare', icon: 'time', color: colors.warning },
    { value: 'in-progress', label: 'În lucru', icon: 'sync', color: colors.info },
    { value: 'completed', label: 'Finalizat', icon: 'checkmark-circle', color: colors.success },
    { value: 'cancelled', label: 'Anulat', icon: 'close-circle', color: colors.secondary },
    { value: 'critical', label: 'Critic', icon: 'alert-circle', color: colors.error }
  ];

  // Fetch data functions
  const fetchServiceRecords = useCallback(async () => {
    try {
      const response = await axios.get('/ambulance-service');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const recordsData = await Promise.all(response.data.data.map(async record => {
          // Format date
          const recordDate = new Date(record.date);
          const formattedDate = recordDate.toISOString().split('T')[0];
          
          // Get city info
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
              } else if (cityId === '6823053af3c9fed99da59f39') {
                cityName = 'Suceava';
              } else if (cityId === '6823053af3c9fed99da59f3a') {
                cityName = 'Botoșani';
              }
            }
          }
          
          // Get vehicle info
          let vehiclePlateNumber = 'N/A';
          let vehicleModel = 'N/A';
          let vehicleType = 'N/A';
          let vehicleId = null;
          
          if (record.vehicle) {
            if (typeof record.vehicle === 'object') {
              vehiclePlateNumber = record.vehicle.plateNumber || 'N/A';
              vehicleModel = record.vehicle.model || 'N/A';
              vehicleType = record.vehicle.type || 'N/A';
              vehicleId = record.vehicle._id;
            } else if (typeof record.vehicle === 'string') {
              vehicleId = record.vehicle;
              const foundVehicle = vehicles.find(v => v._id === vehicleId);
              if (foundVehicle) {
                vehiclePlateNumber = foundVehicle.plateNumber;
                vehicleModel = foundVehicle.model || 'N/A';
                vehicleType = foundVehicle.type || 'N/A';
              }
            }
          }
          
          // Get reporter info
          let reporterName = 'Necunoscut';
          let reporterId = null;
          
          if (record.reporter) {
            if (typeof record.reporter === 'object') {
              reporterName = record.reporter.name || 'Necunoscut';
              reporterId = record.reporter._id;
            } else if (typeof record.reporter === 'string') {
              reporterId = record.reporter;
              
              if (reporterId === user._id) {
                reporterName = user.name;
              } else {
                try {
                  const userResponse = await axios.get(`/users/${reporterId}`);
                  if (userResponse.data && userResponse.data.data) {
                    reporterName = userResponse.data.data.name || 'Necunoscut';
                  }
                } catch (error) {
                  console.error(`Nu s-a putut obține reporter-ul cu ID ${reporterId}:`, error);
                }
              }
            }
          }
          
          // Get mechanic info
          let mechanicName = 'Nealocat';
          let mechanicId = null;
          
          if (record.assignedTo) {
            if (typeof record.assignedTo === 'object') {
              mechanicName = record.assignedTo.name || 'Nealocat';
              mechanicId = record.assignedTo._id;
            } else if (typeof record.assignedTo === 'string') {
              mechanicId = record.assignedTo;
              
              if (mechanicId === user._id) {
                mechanicName = user.name;
              } else {
                const foundMechanic = mechanics.find(m => m._id === mechanicId);
                if (foundMechanic) {
                  mechanicName = foundMechanic.name;
                } else {
                  try {
                    const userResponse = await axios.get(`/users/${mechanicId}`);
                    if (userResponse.data && userResponse.data.data) {
                      mechanicName = userResponse.data.data.name || 'Mecanic';
                    }
                  } catch (error) {
                    console.error(`Nu s-a putut obține mecanicul cu ID ${mechanicId}:`, error);
                  }
                }
              }
            }
          }
          
          // Format completion date if exists
          let completionDate = null;
          if (record.completionDate) {
            const date = new Date(record.completionDate);
            completionDate = date.toISOString().split('T')[0];
          }

          return {
            _id: record._id,
            date: formattedDate,
            title: record.title,
            description: record.description,
            km: record.km,
            status: record.status,
            vehiclePlateNumber,
            vehicleModel,
            vehicleType,
            vehicleId,
            city: cityName,
            cityId,
            reporterName,
            reporterId,
            mechanicName,
            mechanicId,
            partsReplaced: record.partsReplaced || '',
            partsCost: record.partsCost || 0,
            nextServiceKm: record.nextServiceKm || '',
            notes: record.notes || '',
            problemImage: record.problemImage,
            receiptImage: record.receiptImage,
            completionDate,
          };
        }));
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
            
        let filteredRecords = recordsData;
        
        // Filter based on role
        if (!isAdmin && !isMechanic) {
          // Regular user sees only records from their city
          filteredRecords = recordsData.filter(record => record.cityId === userCityId);
        } else if (isMechanic && !isAdmin) {
          // Mechanic sees records from their city and assigned to them
          filteredRecords = recordsData.filter(record => 
            record.cityId === userCityId || record.mechanicId === user._id
          );
        }
        
        setServiceRecords(filteredRecords);
      } else {
        console.warn('Nu s-au găsit înregistrări de service');
        setServiceRecords([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Eroare la încărcarea înregistrărilor de service:', err);
      setError(err.response?.data?.message || 'Nu s-au putut obține înregistrările');
      setServiceRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isAdmin, isMechanic, vehicles, cities, mechanics]);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get('/vehicles');
      
      if (response.data && response.data.data) {
        const allVehicles = response.data.data;
        
        const processedVehicles = allVehicles.map(vehicle => {
          let cityName = 'Necunoscut';
          let cityId = null;
          
          if (vehicle.city) {
            if (typeof vehicle.city === 'object' && vehicle.city.name) {
              cityName = vehicle.city.name;
              cityId = vehicle.city._id;
            } else if (typeof vehicle.city === 'string') {
              cityId = vehicle.city;
              
              if (cityId === '6823053af3c9fed99da59f39') {
                cityName = 'Suceava';
              } else if (cityId === '6823053af3c9fed99da59f3a') {
                cityName = 'Botoșani';
              }
            }
          }
          
          return {
            _id: vehicle._id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model || 'N/A',
            type: vehicle.type || 'N/A',
            city: cityName,
            cityId: cityId
          };
        });
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
        
        const filteredVehicles = isAdmin 
          ? processedVehicles 
          : processedVehicles.filter(vehicle => vehicle.cityId === userCityId);
        
        setVehicles(filteredVehicles);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea vehiculelor:', err);
      setVehicles([]);
    }
  };

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
        }
      } else {
        setCities([
          { _id: '6823053af3c9fed99da59f39', name: 'Suceava' },
          { _id: '6823053af3c9fed99da59f3a', name: 'Botoșani' }
        ]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea orașelor:', err);
      setCities([
        { _id: '6823053af3c9fed99da59f39', name: 'Suceava' },
        { _id: '6823053af3c9fed99da59f3a', name: 'Botoșani' }
      ]);
    }
  };

  const fetchMechanics = async () => {
    try {
      const response = await axios.get('/users/mechanics');
      
      if (response.data && response.data.data) {
        const mechanics = response.data.data;
        
        const processedMechanics = mechanics.map(mechanic => ({
          _id: mechanic._id,
          name: mechanic.name || 'Mecanic necunoscut',
          city: mechanic.city && mechanic.city.name ? mechanic.city.name : 'Oraș necunoscut',
          cityId: mechanic.city && mechanic.city._id ? mechanic.city._id : null
        }));
        
        setMechanics(processedMechanics);
      } else {
        setMechanics([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea mecanicilor:', err);
      setMechanics([]);
    }
  };

  const fetchServiceStats = async () => {
    try {
      const response = await axios.get('/ambulance-service/stats');
      
      if (response.data && response.data.data) {
        setServiceStats(response.data.data);
      }
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor de service:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchVehicles();
      fetchCities();
      fetchMechanics();
      fetchServiceStats();
    }
  }, [user]);

  useEffect(() => {
    if (user && vehicles.length > 0 && cities.length > 0) {
      fetchServiceRecords();
    }
  }, [user, vehicles, cities, fetchServiceRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServiceRecords();
    fetchServiceStats();
  };

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return moment(date).format('DD MMMM YYYY');
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusStyle = (status) => {
    const statusType = serviceStatusTypes.find(type => type.value === status);
    return statusType || { value: 'pending', label: 'În așteptare', icon: 'time', color: colors.warning };
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

  // Document handling
  const pickImage = async (type) => {
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
      if (type === 'problem') {
        setSelectedProblemFile({
          uri: result.assets[0].uri,
          name: `IMG_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      } else {
        setSelectedReceiptFile({
          uri: result.assets[0].uri,
          name: `RECEIPT_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
    }
  };

  const pickDocument = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        if (type === 'problem') {
          setSelectedProblemFile({
            uri: result.uri,
            name: result.name,
            type: result.mimeType || 'application/octet-stream',
          });
        } else {
          setSelectedReceiptFile({
            uri: result.uri,
            name: result.name,
            type: result.mimeType || 'application/octet-stream',
          });
        }
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const uploadImage = async (recordId, type) => {
    setActiveImageType(type);
    const file = type === 'problem' ? selectedProblemFile : selectedReceiptFile;
    
    if (!file) {
      Alert.alert('Eroare', `Vă rugăm să selectați un fișier pentru ${type === 'problem' ? 'imaginea problemei' : 'bonul fiscal'}`);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append(type, {
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
      
      // Simulăm progresul pentru UX mai bun
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
        `/ambulance-service/${recordId}/upload-${type}-image`,
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
        if (type === 'problem') {
          setSelectedProblemFile(null);
        } else {
          setSelectedReceiptFile(null);
        }
        
        Alert.alert('Succes', `${type === 'problem' ? 'Imaginea problemei' : 'Bonul fiscal'} a fost încărcat cu succes!`);
        
        // Reîncarcă înregistrarea pentru a obține imaginea actualizată
        try {
          const recordResponse = await axios.get(`/ambulance-service/${recordId}`);
          
          if (recordResponse.data && recordResponse.data.success) {
            const updatedRecord = recordResponse.data.data;
            
            // Actualizăm înregistrarea curentă dacă este cea care se afișează
            if (currentRecord && currentRecord._id === recordId) {
              setCurrentRecord({
                ...currentRecord,
                problemImage: type === 'problem' ? updatedRecord.problemImage : currentRecord.problemImage,
                receiptImage: type === 'receipt' ? updatedRecord.receiptImage : currentRecord.receiptImage
              });
            }
            
            // Actualizăm și lista generală
            setServiceRecords(prevRecords => 
              prevRecords.map(r => 
                r._id === recordId ? {
                  ...r,
                  problemImage: type === 'problem' ? updatedRecord.problemImage : r.problemImage,
                  receiptImage: type === 'receipt' ? updatedRecord.receiptImage : r.receiptImage
                } : r
              )
            );
          }
        } catch (fetchErr) {
          console.error(`Eroare la reîncărcarea înregistrării după încărcare ${type}:`, fetchErr);
        }
      }
    } catch (err) {
      console.error(`Eroare la încărcarea ${type === 'problem' ? 'imaginii problemei' : 'bonului fiscal'}:`, err);
      Alert.alert('Eroare', err.response?.data?.message || `Nu s-a putut încărca ${type === 'problem' ? 'imaginea problemei' : 'bonul fiscal'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setActiveImageType(null);
    }
  };

  const downloadImage = async (recordId, type) => {
    try {
      Alert.alert(
        'Descărcare imagine',
        'Funcționalitatea de descărcare nu este disponibilă încă în versiunea mobile.',
        [{ text: 'OK' }]
      );
      // TODO: Implementare descărcare cu expo-file-system
    } catch (err) {
      console.error(`Eroare la descărcare:`, err);
      Alert.alert('Eroare', 'Nu s-a putut descărca imaginea');
    }
  };

  // Handlers
  const handleAddNewRecord = () => {
    const initialFormData = {
      vehicle: '',
      title: '',
      description: '',
      km: '',
      status: 'pending',
      partsReplaced: '',
      partsCost: '0',
      nextServiceKm: '',
      notes: '',
      cityId: '',
      assignedTo: ''
    };
    
    if (!isAdmin && user.city) {
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      initialFormData.cityId = userCityId;
    }
    
    setFormData(initialFormData);
    setSelectedProblemFile(null);
    setSelectedReceiptFile(null);
    setShowAddModal(true);
  };

  const handleViewRecord = (record) => {
    setCurrentRecord(record);
    setSelectedProblemFile(null);
    setSelectedReceiptFile(null);
    setShowViewModal(true);
  };

  const handleEditInit = (record) => {
    setFormData({
      vehicle: record.vehicleId || '',
      title: record.title || '',
      description: record.description || '',
      km: record.km ? record.km.toString() : '',
      status: record.status || 'pending',
      partsReplaced: record.partsReplaced || '',
      partsCost: record.partsCost ? record.partsCost.toString() : '0',
      nextServiceKm: record.nextServiceKm ? record.nextServiceKm.toString() : '',
      notes: record.notes || '',
      cityId: record.cityId || '',
      assignedTo: record.mechanicId || ''
    });
    
    setRecordToEdit(record);
    setShowEditModal(true);
  };

  const handleAssignInit = (record) => {
    setRecordToAssign(record);
    setFormData(prevData => ({
      ...prevData,
      assignedTo: record.mechanicId || ''
    }));
    setShowAssignModal(true);
  };

  const handleStatusInit = (record) => {
    setRecordToUpdateStatus(record);
    setShowStatusModal(true);
  };

  const handleDeleteInit = (record) => {
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.vehicle) {
        Alert.alert('Eroare', 'Vă rugăm să selectați o ambulanță!');
        return;
      }
      
      const recordData = {
        vehicle: formData.vehicle,
        title: formData.title,
        description: formData.description,
        km: parseInt(formData.km),
        status: formData.status,
        partsReplaced: formData.partsReplaced,
        partsCost: parseFloat(formData.partsCost) || 0,
        nextServiceKm: formData.nextServiceKm ? parseInt(formData.nextServiceKm) : null,
        notes: formData.notes,
        city: formData.cityId,
        assignedTo: formData.assignedTo || null
      };
      
      const response = await axios.post('/ambulance-service', recordData);
      
      if (response.data && response.data.data) {
        const createdRecord = response.data.data;
        
        // Upload problem image if selected
        if (selectedProblemFile) {
          await uploadImage(createdRecord._id, 'problem');
        }
        
        // Upload receipt image if selected
        if (selectedReceiptFile) {
          await uploadImage(createdRecord._id, 'receipt');
        }
        
        Alert.alert('Succes', 'Înregistrarea a fost adăugată cu succes!');
        setShowAddModal(false);
        fetchServiceRecords();
        fetchServiceStats();
      } else {
        Alert.alert('Eroare', 'Eroare la adăugarea înregistrării');
      }
    } catch (err) {
      console.error('Eroare la adăugarea înregistrării:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga înregistrarea');
    }
  };

  const handleEditSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      if (!formData.vehicle) {
        Alert.alert('Eroare', 'Vă rugăm să selectați o ambulanță!');
        return;
      }
      
      const recordData = {
        vehicle: formData.vehicle,
        title: formData.title,
        description: formData.description,
        km: parseInt(formData.km),
        status: formData.status,
        partsReplaced: formData.partsReplaced,
        partsCost: parseFloat(formData.partsCost) || 0,
        nextServiceKm: formData.nextServiceKm ? parseInt(formData.nextServiceKm) : null,
        notes: formData.notes,
        city: formData.cityId,
        assignedTo: formData.assignedTo || null
      };
      
      await axios.put(`/ambulance-service/${recordToEdit._id}`, recordData);
      
      Alert.alert('Succes', 'Înregistrarea a fost actualizată cu succes!');
      setShowEditModal(false);
      setRecordToEdit(null);
      fetchServiceRecords();
      fetchServiceStats();
      
    } catch (err) {
      console.error('Eroare la actualizarea înregistrării:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza înregistrarea');
    }
  };

  const handleAssignSubmit = async () => {
    try {
      if (!formData.assignedTo) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un mecanic!');
        return;
      }
      
      await axios.put(`/ambulance-service/${recordToAssign._id}/assign/${formData.assignedTo}`);
      
      Alert.alert('Succes', 'Mecanicul a fost asignat cu succes!');
      setShowAssignModal(false);
      setRecordToAssign(null);
      fetchServiceRecords();
      fetchServiceStats();
      
    } catch (err) {
      console.error('Eroare la asignarea mecanicului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut asigna mecanicul');
    }
  };

 const handleStatusUpdate = async (newStatus) => {
    try {
      const updateData = {
        status: newStatus
      };
      
      await axios.put(`/ambulance-service/${recordToUpdateStatus._id}`, updateData);
      
      Alert.alert('Succes', `Statusul a fost actualizat la: ${getStatusStyle(newStatus).label}`);
      setShowStatusModal(false);
      setRecordToUpdateStatus(null);
      fetchServiceRecords();
      fetchServiceStats();
      
    } catch (err) {
      console.error('Eroare la actualizarea statusului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza statusul');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`/ambulance-service/${recordToDelete._id}`);
      
      Alert.alert('Succes', 'Înregistrarea a fost ștearsă cu succes');
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
      fetchServiceRecords();
      fetchServiceStats();
      
    } catch (err) {
      console.error('Eroare la ștergere:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut șterge înregistrarea');
      setShowDeleteConfirm(false);
    }
  };

  // Filtered records
  const filteredRecords = serviceRecords.filter(record => {
    const matchesSearch = 
      searchTerm === '' || 
      (record.vehiclePlateNumber && record.vehiclePlateNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.title && record.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.description && record.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === '' || record.status === statusFilter;
    
    const matchesVehicle = vehicleFilter === '' || record.vehicleId === vehicleFilter;
    
    return matchesSearch && matchesStatus && matchesVehicle;
  });

  // Render functions
  const renderServiceRecordItem = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const hasProblemImage = !!item.problemImage;
    const hasReceiptImage = !!item.receiptImage;
    
    return (
      <TouchableOpacity 
        style={styles.recordCard}
        onPress={() => handleViewRecord(item)}
      >
        <View style={styles.recordHeader}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlateNumber}>{item.vehiclePlateNumber}</Text>
            {(hasProblemImage || hasReceiptImage) && (
              <View style={styles.documentBadge}>
                <Ionicons name="attach" size={14} color="#fff" />
                <Text style={styles.documentBadgeText}>
                  {(hasProblemImage ? 1 : 0) + (hasReceiptImage ? 1 : 0)}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.color }]}>
            <Ionicons name={statusStyle.icon} size={16} color="#fff" />
            <Text style={styles.statusText}>{statusStyle.label}</Text>
          </View>
        </View>

        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{item.title}</Text>
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <View style={styles.serviceDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.km} km</Text>
          </View>
          {item.nextServiceKm && (
            <View style={styles.detailRow}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.detailText}>Următorul service: {item.nextServiceKm} km</Text>
            </View>
          )}
        </View>

        <View style={styles.recordFooter}>
          <View style={styles.footerLeft}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>
              {formatDate(item.date)}
            </Text>
          </View>
          
          <View style={styles.footerRight}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.mechanicText}>{item.mechanicName}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.info }]}
            onPress={() => handleStatusInit(item)}
          >
            <Ionicons name="sync" size={18} color="#fff" />
          </TouchableOpacity>
          
          {(isAdmin || isMechanic) && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.secondary }]}
              onPress={() => handleAssignInit(item)}
              disabled={item.status === 'completed' || item.status === 'cancelled'}
            >
              <Ionicons 
                name="person-add" 
                size={18} 
                color={item.status === 'completed' || item.status === 'cancelled' ? colors.textSecondary : "#fff"} 
              />
            </TouchableOpacity>
          )}
          
          {(isAdmin || isMechanic || item.reporterId === user._id) && (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.warning }]}
                onPress={() => handleEditInit(item)}
              >
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={() => handleDeleteInit(item)}
              >
                <Ionicons name="trash" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderStats = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.statsContainer}
      contentContainerStyle={styles.statsContent}
    >
      <View style={[styles.statCard, { backgroundColor: colors.warning }]}>
        <Text style={styles.statValue}>{serviceStats.pending}</Text>
        <Text style={styles.statLabel}>În așteptare</Text>
        <Ionicons name="time" size={24} color="#fff" style={styles.statIcon} />
      </View>
      
      <View style={[styles.statCard, { backgroundColor: colors.info }]}>
        <Text style={styles.statValue}>{serviceStats['in-progress']}</Text>
        <Text style={styles.statLabel}>În lucru</Text>
        <Ionicons name="sync" size={24} color="#fff" style={styles.statIcon} />
      </View>
      
      <View style={[styles.statCard, { backgroundColor: colors.success }]}>
        <Text style={styles.statValue}>{serviceStats.completed}</Text>
        <Text style={styles.statLabel}>Finalizate</Text>
        <Ionicons name="checkmark-circle" size={24} color="#fff" style={styles.statIcon} />
      </View>
      
      <View style={[styles.statCard, { backgroundColor: colors.error }]}>
        <Text style={styles.statValue}>{serviceStats.critical}</Text>
        <Text style={styles.statLabel}>Critice</Text>
        <Ionicons name="alert-circle" size={24} color="#fff" style={styles.statIcon} />
      </View>
      
      <View style={[styles.statCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.statValue}>{serviceStats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
        <Ionicons name="construct" size={24} color="#fff" style={styles.statIcon} />
      </View>
    </ScrollView>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Caută număr ambulanță, titlu..."
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <TouchableOpacity 
        style={styles.filterButton}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Ionicons name="filter" size={20} color={colors.primary} />
        <Text style={styles.filterButtonText}>Filtre</Text>
      </TouchableOpacity>

      {showFilters && (
        <View style={styles.filterOptions}>
          <Text style={styles.filterLabel}>Status:</Text>
          <Picker
            selectedValue={statusFilter}
            onValueChange={setStatusFilter}
            style={styles.picker}
          >
            <Picker.Item label="Toate" value="" />
            {serviceStatusTypes.map(option => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>

          <Text style={styles.filterLabel}>Ambulanță:</Text>
          <Picker
            selectedValue={vehicleFilter}
            onValueChange={setVehicleFilter}
            style={styles.picker}
          >
            <Picker.Item label="Toate ambulanțele" value="" />
            {vehicles.map(vehicle => (
              <Picker.Item 
                key={vehicle._id} 
                label={`${vehicle.plateNumber} (${vehicle.model})`} 
                value={vehicle._id} 
              />
            ))}
          </Picker>
        </View>
      )}
    </View>
  );

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
            <Text style={styles.modalTitle}>Adaugă Service Ambulanță</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.vehicle}
                onValueChange={(value) => setFormData({...formData, vehicle: value})}
                style={styles.picker}
              >
                <Picker.Item label="Selectați o ambulanță" value="" />
                {vehicles.map(vehicle => (
                  <Picker.Item 
                    key={vehicle._id} 
                    label={`${vehicle.plateNumber} - ${vehicle.model} (${vehicle.city})`} 
                    value={vehicle._id} 
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.cityId}
                onValueChange={(value) => setFormData({...formData, cityId: value})}
                style={styles.picker}
                enabled={isAdmin || !user.city}
              >
                <Picker.Item label="Selectați orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Titlu problemă/lucrare *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({...formData, title: text})}
              placeholder="Ex: Schimb ulei, Frâne, etc."
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Kilometraj actual *</Text>
            <TextInput
              style={styles.input}
              value={formData.km}
              onChangeText={(text) => setFormData({...formData, km: text})}
              placeholder="Ex: 15000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Descriere problemă/lucrare *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({...formData, description: text})}
              placeholder="Descrieți detaliat problema sau lucrarea ce trebuie efectuată..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
                style={styles.picker}
              >
                {serviceStatusTypes.map(option => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>

            {(isAdmin || isMechanic) && (
              <>
                <Text style={styles.inputLabel}>Asignează Mecanic</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.assignedTo}
                    onValueChange={(value) => setFormData({...formData, assignedTo: value})}
                    style={styles.picker}
                  >
                    <Picker.Item label="Fără mecanic asignat" value="" />
                    {mechanics.map(mechanic => (
                      <Picker.Item 
                        key={mechanic._id} 
                        label={`${mechanic.name} (${mechanic.city})`} 
                        value={mechanic._id} 
                      />
                    ))}
                  </Picker>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Piese înlocuite</Text>
            <TextInput
              style={styles.input}
              value={formData.partsReplaced}
              onChangeText={(text) => setFormData({...formData, partsReplaced: text})}
              placeholder="Listați piesele înlocuite sau ce trebuie înlocuit..."
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Cost piese (RON)</Text>
            <TextInput
              style={styles.input}
              value={formData.partsCost}
              onChangeText={(text) => setFormData({...formData, partsCost: text})}
              placeholder="Ex: 1500.50"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Următorul service la km</Text>
            <TextInput
              style={styles.input}
              value={formData.nextServiceKm}
              onChangeText={(text) => setFormData({...formData, nextServiceKm: text})}
              placeholder="Ex: 20000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Note suplimentare</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({...formData, notes: text})}
              placeholder="Note adiționale..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            {/* Document Upload Section */}
            <View style={styles.documentSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="camera" size={18} color={colors.primary} /> Imagine Problemă
              </Text>
              
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickDocument('problem')}
                >
                  <Ionicons name="document" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Încarcă imagine</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickImage('problem')}
                >
                  <Ionicons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Fă o poză</Text>
                </TouchableOpacity>
              </View>

              {selectedProblemFile && (
                <View style={styles.selectedDocument}>
                  <Ionicons 
                    name={getFileIcon(selectedProblemFile.type)} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.selectedDocumentName} numberOfLines={1}>
                    {selectedProblemFile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedProblemFile(null)}>
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.documentSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="receipt" size={18} color={colors.primary} /> Bon/Factură
              </Text>
              
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickDocument('receipt')}
                >
                  <Ionicons name="document" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Încarcă bon</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickImage('receipt')}
                >
                  <Ionicons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Fă o poză</Text>
                </TouchableOpacity>
              </View>

              {selectedReceiptFile && (
                <View style={styles.selectedDocument}>
                  <Ionicons 
                    name={getFileIcon(selectedReceiptFile.type)} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.selectedDocumentName} numberOfLines={1}>
                    {selectedReceiptFile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedReceiptFile(null)}>
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
            <Text style={styles.modalTitle}>Editează Service Ambulanță</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.vehicle}
                onValueChange={(value) => setFormData({...formData, vehicle: value})}
                style={styles.picker}
              >
                <Picker.Item label="Selectați o ambulanță" value="" />
                {vehicles.map(vehicle => (
                  <Picker.Item 
                    key={vehicle._id} 
                    label={`${vehicle.plateNumber} - ${vehicle.model} (${vehicle.city})`} 
                    value={vehicle._id} 
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Oraș *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.cityId}
                onValueChange={(value) => setFormData({...formData, cityId: value})}
                style={styles.picker}
                enabled={isAdmin || !user.city}
              >
                <Picker.Item label="Selectați orașul" value="" />
                {cities.map(city => (
                  <Picker.Item key={city._id} label={city.name} value={city._id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Titlu problemă/lucrare *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({...formData, title: text})}
              placeholder="Ex: Schimb ulei, Frâne, etc."
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Kilometraj actual *</Text>
            <TextInput
              style={styles.input}
              value={formData.km}
              onChangeText={(text) => setFormData({...formData, km: text})}
              placeholder="Ex: 15000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Descriere problemă/lucrare *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({...formData, description: text})}
              placeholder="Descrieți detaliat problema sau lucrarea ce trebuie efectuată..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
                style={styles.picker}
              >
                {serviceStatusTypes.map(option => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>

            {(isAdmin || isMechanic) && (
              <>
                <Text style={styles.inputLabel}>Asignează Mecanic</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.assignedTo}
                    onValueChange={(value) => setFormData({...formData, assignedTo: value})}
                    style={styles.picker}
                  >
                    <Picker.Item label="Fără mecanic asignat" value="" />
                    {mechanics.map(mechanic => (
                      <Picker.Item 
                        key={mechanic._id} 
                        label={`${mechanic.name} (${mechanic.city})`} 
                        value={mechanic._id} 
                      />
                    ))}
                  </Picker>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Piese înlocuite</Text>
            <TextInput
              style={styles.input}
              value={formData.partsReplaced}
              onChangeText={(text) => setFormData({...formData, partsReplaced: text})}
              placeholder="Listați piesele înlocuite sau ce trebuie înlocuit..."
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Cost piese (RON)</Text>
            <TextInput
              style={styles.input}
              value={formData.partsCost}
              onChangeText={(text) => setFormData({...formData, partsCost: text})}
              placeholder="Ex: 1500.50"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Următorul service la km</Text>
            <TextInput
              style={styles.input}
              value={formData.nextServiceKm}
              onChangeText={(text) => setFormData({...formData, nextServiceKm: text})}
              placeholder="Ex: 20000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Note suplimentare</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({...formData, notes: text})}
              placeholder="Note adiționale..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Imaginile pot fi gestionate din vizualizarea detaliată a înregistrării.
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
            <Text style={styles.modalTitle}>Detalii Service Ambulanță</Text>
            <TouchableOpacity onPress={() => setShowViewModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {currentRecord && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informații Generale</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Data raportării: </Text>
                    {formatDate(currentRecord.date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Ambulanță: </Text>
                    {currentRecord.vehiclePlateNumber}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Model: </Text>
                    {currentRecord.vehicleModel} ({currentRecord.vehicleType})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Kilometraj: </Text>
                    {currentRecord.km} km
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Oraș: </Text>
                    {currentRecord.city}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status & Responsabili</Text>
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getStatusStyle(currentRecord.status).icon} 
                    size={18} 
                    color={getStatusStyle(currentRecord.status).color} 
                  />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Status: </Text>
                    {getStatusStyle(currentRecord.status).label}
                  </Text>
                  </View>
                {currentRecord.completionDate && (
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Data finalizării: </Text>
                      {formatDate(currentRecord.completionDate)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Raportat de: </Text>
                    {currentRecord.reporterName}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="build-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Mecanic asignat: </Text>
                    {currentRecord.mechanicName}
                  </Text>
                </View>
                {currentRecord.nextServiceKm && (
                  <View style={styles.detailRow}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Următorul service la: </Text>
                      {currentRecord.nextServiceKm} km
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Detalii Problemă/Lucrare</Text>
                <View style={styles.fullWidthDetail}>
                  <Text style={styles.detailLabel}>Titlu:</Text>
                  <Text style={styles.detailContent}>{currentRecord.title}</Text>
                </View>
                <View style={styles.fullWidthDetail}>
                  <Text style={styles.detailLabel}>Descriere:</Text>
                  <Text style={styles.detailContent}>{currentRecord.description}</Text>
                </View>
                
                {currentRecord.partsReplaced && (
                  <View style={styles.fullWidthDetail}>
                    <Text style={styles.detailLabel}>Piese înlocuite:</Text>
                    <Text style={styles.detailContent}>{currentRecord.partsReplaced}</Text>
                  </View>
                )}
                
                {currentRecord.partsCost > 0 && (
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Cost piese: </Text>
                      {formatAmount(currentRecord.partsCost)}
                    </Text>
                  </View>
                )}
                
                {currentRecord.notes && (
                  <View style={styles.fullWidthDetail}>
                    <Text style={styles.detailLabel}>Note suplimentare:</Text>
                    <Text style={styles.detailContent}>{currentRecord.notes}</Text>
                  </View>
                )}
              </View>
              
              {/* Imagine Problemă Section */}
              <View style={styles.detailSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.detailSectionTitle}>Imagine Problemă</Text>
                  <View style={styles.documentActions}>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={() => pickDocument('problem')}
                    >
                      <Ionicons name="document" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={() => pickImage('problem')}
                    >
                      <Ionicons name="camera" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {selectedProblemFile && (
                  <View style={styles.uploadProgress}>
                    <View style={styles.selectedDocument}>
                      <Ionicons 
                        name={getFileIcon(selectedProblemFile.type)} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={styles.selectedDocumentName} numberOfLines={1}>
                        {selectedProblemFile.name}
                      </Text>
                    </View>
                    <View style={styles.uploadActions}>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.primary }]}
                        onPress={() => uploadImage(currentRecord._id, 'problem')}
                        disabled={isUploading}
                      >
                        <Text style={styles.uploadActionText}>
                          {isUploading && activeImageType === 'problem' ? 'Se încarcă...' : 'Încarcă'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.error }]}
                        onPress={() => setSelectedProblemFile(null)}
                      >
                        <Ionicons name="trash" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    {isUploading && activeImageType === 'problem' && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                      </View>
                    )}
                  </View>
                )}

                {currentRecord.problemImage ? (
                  <View style={styles.imageContainer}>
                    <View style={styles.imageHeader}>
                      <Text style={styles.imageTitle}>Imagine atașată:</Text>
                      <TouchableOpacity 
                        style={styles.downloadButton}
                        onPress={() => downloadImage(currentRecord._id, 'problem')}
                      >
                        <Ionicons name="download" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Image
                      source={{ uri: `/uploads/${currentRecord.problemImage.replace(/^uploads\//, '')}` }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.noImageContainer}>
                    <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.noImageText}>
                      Nu există imagine atașată. Încărcați o imagine pentru această înregistrare.
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Bon/Factură Section */}
              <View style={styles.detailSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.detailSectionTitle}>Bon/Factură</Text>
                  <View style={styles.documentActions}>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={() => pickDocument('receipt')}
                    >
                      <Ionicons name="document" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.documentActionButton}
                      onPress={() => pickImage('receipt')}
                    >
                      <Ionicons name="camera" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {selectedReceiptFile && (
                  <View style={styles.uploadProgress}>
                    <View style={styles.selectedDocument}>
                      <Ionicons 
                        name={getFileIcon(selectedReceiptFile.type)} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={styles.selectedDocumentName} numberOfLines={1}>
                        {selectedReceiptFile.name}
                      </Text>
                    </View>
                    <View style={styles.uploadActions}>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.primary }]}
                        onPress={() => uploadImage(currentRecord._id, 'receipt')}
                        disabled={isUploading}
                      >
                        <Text style={styles.uploadActionText}>
                          {isUploading && activeImageType === 'receipt' ? 'Se încarcă...' : 'Încarcă'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.error }]}
                        onPress={() => setSelectedReceiptFile(null)}
                      >
                        <Ionicons name="trash" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    {isUploading && activeImageType === 'receipt' && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                      </View>
                    )}
                  </View>
                )}

                {currentRecord.receiptImage ? (
                  <View style={styles.imageContainer}>
                    <View style={styles.imageHeader}>
                      <Text style={styles.imageTitle}>Bon/factură atașat(ă):</Text>
                      <TouchableOpacity 
                        style={styles.downloadButton}
                        onPress={() => downloadImage(currentRecord._id, 'receipt')}
                      >
                        <Ionicons name="download" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Image
                      source={{ uri: `/uploads/${currentRecord.receiptImage.replace(/^uploads\//, '')}` }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.noImageContainer}>
                    <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.noImageText}>
                      Nu există bon/factură atașat(ă). Încărcați un bon/factură pentru această înregistrare.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowViewModal(false)}
            >
              <Text style={styles.cancelButtonText}>Închide</Text>
            </TouchableOpacity>
            {currentRecord && (isAdmin || isMechanic || currentRecord.reporterId === user._id) && (
              <TouchableOpacity 
                style={[styles.modalButton, styles.editButton]}
                onPress={() => {
                  setShowViewModal(false);
                  handleEditInit(currentRecord);
                }}
              >
                <Text style={styles.editButtonText}>
                  <Ionicons name="pencil" size={16} /> Editează
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderAssignModal = () => (
    <Modal
      visible={showAssignModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAssignModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Asignează Mecanic</Text>
            <TouchableOpacity onPress={() => setShowAssignModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {recordToAssign && (
            <View style={styles.modalBody}>
              <View style={styles.assignDetails}>
                <Text style={styles.assignTitle}>Detalii înregistrare:</Text>
                <View style={styles.assignRow}>
                  <Text style={styles.assignLabel}>Ambulanță:</Text>
                  <Text style={styles.assignValue}>{recordToAssign.vehiclePlateNumber}</Text>
                </View>
                <View style={styles.assignRow}>
                  <Text style={styles.assignLabel}>Titlu:</Text>
                  <Text style={styles.assignValue}>{recordToAssign.title}</Text>
                </View>
                <View style={styles.assignRow}>
                  <Text style={styles.assignLabel}>Status:</Text>
                  <View style={[
                    styles.assignStatusBadge, 
                    { backgroundColor: getStatusStyle(recordToAssign.status).color }
                  ]}>
                    <Ionicons 
                      name={getStatusStyle(recordToAssign.status).icon} 
                      size={14} 
                      color="#fff" 
                      style={styles.assignStatusIcon} 
                    />
                    <Text style={styles.assignStatusText}>
                      {getStatusStyle(recordToAssign.status).label}
                    </Text>
                  </View>
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Selectează mecanic *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.assignedTo}
                  onValueChange={(value) => setFormData({...formData, assignedTo: value})}
                  style={styles.picker}
                >
                  <Picker.Item label="Selectează un mecanic" value="" />
                  {mechanics.map(mechanic => (
                    <Picker.Item 
                      key={mechanic._id} 
                      label={`${mechanic.name} (${mechanic.city})`} 
                      value={mechanic._id} 
                    />
                  ))}
                </Picker>
              </View>
              
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.info} />
                <Text style={styles.infoText}>
                  Asignarea unui mecanic va schimba automat statusul din <Text style={styles.boldText}>În așteptare</Text> în <Text style={styles.boldText}>În lucru</Text> dacă este cazul.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAssignModal(false)}
            >
              <Text style={styles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.modalButton, 
                styles.submitButton,
                !formData.assignedTo && styles.disabledButton
              ]}
              onPress={handleAssignSubmit}
              disabled={!formData.assignedTo}
            >
              <Text style={styles.submitButtonText}>Asignează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderStatusModal = () => (
    <Modal
      visible={showStatusModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowStatusModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Actualizare status</Text>
            <TouchableOpacity onPress={() => setShowStatusModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {recordToUpdateStatus && (
            <View style={styles.modalBody}>
              <Text style={styles.statusModalText}>
                Actualizați statusul pentru înregistrarea cu titlul{' '}
                <Text style={styles.boldText}>{recordToUpdateStatus.title}</Text>:
              </Text>

              <View style={styles.statusOptions}>
                {serviceStatusTypes.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusOption,
                      { backgroundColor: option.color }
                    ]}
                    onPress={() => handleStatusUpdate(option.value)}
                  >
                    <Ionicons name={option.icon} size={24} color="#fff" />
                    <Text style={styles.statusOptionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmare ștergere</Text>
            <TouchableOpacity onPress={() => setShowDeleteConfirm(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {recordToDelete && (
            <View style={styles.modalBody}>
              <Text style={styles.deleteConfirmText}>
                Sunteți sigur că doriți să ștergeți înregistrarea de service cu titlul <Text style={styles.boldText}>"{recordToDelete.title}"</Text> pentru ambulanța <Text style={styles.boldText}>{recordToDelete.vehiclePlateNumber}</Text> din data <Text style={styles.boldText}>{formatDate(recordToDelete.date)}</Text>?
              </Text>
              
              {(recordToDelete.problemImage || recordToDelete.receiptImage) && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={styles.warningText}>
                    <Text style={styles.boldText}>Atenție!</Text> Această înregistrare are documente atașate care vor fi șterse permanent:
                    {recordToDelete.problemImage && (
                      <Text style={styles.warningListItem}>{'\n'}• Imagine problemă</Text>
                    )}
                    {recordToDelete.receiptImage && (
                      <Text style={styles.warningListItem}>{'\n'}• Bon/factură</Text>
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <Text style={styles.cancelButtonText}>Anulează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.deleteButton]}
              onPress={handleDeleteConfirm}
            >
              <Text style={styles.deleteButtonText}>
                <Ionicons name="trash" size={16} /> Șterge
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
        <Text style={styles.loadingText}>Se încarcă datele de service...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setLoading(true);
          fetchVehicles();
          fetchCities();
          fetchMechanics();
          fetchServiceStats();
          fetchServiceRecords();
        }}>
          <Text style={styles.retryButtonText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderStats()}
      {renderFilters()}
      
      <FlatList
        data={filteredRecords}
        renderItem={renderServiceRecordItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Nu există înregistrări de service</Text>
            <TouchableOpacity 
              style={styles.addFirstButton}
              onPress={handleAddNewRecord}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addFirstButtonText}>Adaugă prima înregistrare</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddNewRecord}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {renderAddModal()}
      {renderEditModal()}
      {renderViewModal()}
      {renderAssignModal()}
      {renderStatusModal()}
      {renderDeleteConfirmModal()}
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
  
  // Statistics
  statsContainer: {
    maxHeight: 120,
    backgroundColor: colors.card,
    paddingVertical: 15,
  },
  statsContent: {
    paddingHorizontal: 15,
  },
  statCard: {
    borderRadius: 10,
    padding: 15,
    width: 120,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
  },
  statIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    opacity: 0.3,
  },
  
  // Filters
  filtersContainer: {
    padding: 15,
    backgroundColor: colors.card,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    color: colors.text,
    fontSize: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
  },
  filterButtonText: {
    marginLeft: 5,
    color: colors.primary,
    fontWeight: 'bold',
  },
  filterOptions: {
    marginTop: 15,
  },
  filterLabel: {
    color: colors.textSecondary,
    marginBottom: 5,
  },
  picker: {
    color: colors.text,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
  },
  
  // List
  listContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  
  // Record Card
  recordCard: {
    backgroundColor: colors.card,
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
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  vehicleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehiclePlateNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  documentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  documentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
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
  serviceInfo: {
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  serviceDescription: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  serviceDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailText: {
    flex: 1,
    marginLeft: 8,
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
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 12,
  },
  mechanicText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    overflow: 'hidden',
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
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.7,
  },
  editButton: {
    backgroundColor: colors.warning,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Document Upload Section
  documentSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
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
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: colors.info,
    fontSize: 14,
  },
  
  // Warning Box
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.error + '20',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    color: colors.error,
    fontSize: 14,
  },
  warningListItem: {
    color: colors.error,
    fontSize: 14,
    marginTop: 5,
  },
  
  // Detail View
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  fullWidthDetail: {
    marginBottom: 10,
  },
  detailContent: {
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.inputBackground,
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  
  // Document Management
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
  
  // Image Display
  imageContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageTitle: {
    fontWeight: 'bold',
    color: colors.text,
  },
  downloadButton: {
    padding: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
  },
  noImageContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    marginTop: 10,
  },
  noImageText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  // Status Modal
  statusModalText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: 'bold',
  },
  statusOptions: {
    gap: 10,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
  },
  statusOptionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  
  // Delete Confirm
  deleteConfirmText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  
  // Assign Modal
  assignDetails: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignLabel: {
    width: 90,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  assignValue: {
    flex: 1,
    color: colors.text,
  },
  assignStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  assignStatusIcon: {
    marginRight: 5,
  },
  assignStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default AmbulanceServiceScreen;