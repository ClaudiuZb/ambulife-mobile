// src/screens/services/CNASBookingsScreen.js
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

const CNASBookingsScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [brigadeMembers, setBrigadeMembers] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bookingToUpdateStatus, setBookingToUpdateStatus] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState(null);
  
  // Document states
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [formData, setFormData] = useState({
    patientName: '',
    pickupLocation: '',
    destinationLocation: '',
    bookingDate: new Date(),
    bookingTime: new Date(),
    notes: '',
    status: 'Urmează',
    cityId: '',
    brigadeEmployeeId: ''
  });

  const statusOptions = [
    { value: 'Finalizat', icon: 'checkmark-circle', color: colors.success },
    { value: 'Urmează', icon: 'time', color: colors.primary },
    { value: 'Anulat', icon: 'close-circle', color: colors.error }
  ];

  // Fetch functions
  const fetchBookings = useCallback(async () => {
    try {
      const response = await axios.get('/cnas-services');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const bookingsData = await Promise.all(response.data.data.map(async service => {
          const patientName = service.patientName || 'Pacient necunoscut';
          
          const serviceDate = new Date(service.date);
          const bookingDate = serviceDate.toISOString().split('T')[0];
          const bookingTime = serviceDate.toTimeString().slice(0, 5);
          
          let cityName = 'Necunoscut';
          let cityId = null;
          
          if (service.city) {
            if (typeof service.city === 'object') {
              cityName = service.city.name || 'Necunoscut';
              cityId = service.city._id;
            } else if (typeof service.city === 'string') {
              cityId = service.city;
              if (cityId === '6823053af3c9fed99da59f39') {
                cityName = 'Suceava';
              } else if (cityId === '6823053af3c9fed99da59f3a') {
                cityName = 'Botoșani';
              }
            }
          }
          
          let assistantName = 'Nealocat';
          let assistantId = null;
          
          if (service.assistant) {
            if (typeof service.assistant === 'object') {
              assistantName = service.assistant.name || 'Nealocat';
              assistantId = service.assistant._id;
            } else if (typeof service.assistant === 'string') {
              assistantId = service.assistant;
              
              if (assistantId === user._id) {
                assistantName = user.name;
              } else {
                const foundMember = brigadeMembers.find(m => m._id === assistantId);
                if (foundMember) {
                  assistantName = foundMember.name;
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
          }
          
          const documents = service.documents || [];
          
          return {
            _id: service._id,
            patientName,
            pickupLocation: service.pickupPoint,
            destinationLocation: service.dropoffPoint,
            bookingDate,
            bookingTime,
            city: cityName,
            cityId,
            assistantName,
            assistantId,
            status: mapBackendStatus(service.status),
            notes: service.notes,
            documents,
          };
        }));
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
            
        const filteredBookings = isAdmin 
          ? bookingsData 
          : bookingsData.filter(booking => booking.cityId === userCityId);
        
        setBookings(filteredBookings);
      } else {
        setBookings([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Eroare la încărcarea programărilor CNAS:', err);
      setError(err.response?.data?.message || 'Nu s-au putut obține programările');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isAdmin, brigadeMembers]);

  const fetchBrigadeMembers = async () => {
    try {
      const response = await axios.get('/users');
      
      if (response.data && response.data.data) {
        const allUsers = response.data.data;
        const assistantUsers = allUsers.filter(user => user.role === 'assistant');
        
        const members = assistantUsers.map(user => ({
          _id: user._id,
          name: user.name,
          city: user.city && typeof user.city === 'object' && user.city.name 
            ? user.city.name 
            : 'Oraș necunoscut',
          cityId: user.city && typeof user.city === 'object' && user.city._id 
            ? user.city._id 
            : typeof user.city === 'string' 
              ? user.city 
              : null
        }));
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
        
        const filteredMembers = isAdmin 
          ? members 
          : members.filter(member => member.cityId === userCityId);
        
        setBrigadeMembers(filteredMembers);
      }
    } catch (err) {
      console.error('Eroare la încărcarea membrilor:', err);
      setBrigadeMembers([]);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await axios.get('/cities');
      
      if (response.data && response.data.data) {
        setCities(response.data.data);
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

  useEffect(() => {
    if (user) {
      fetchBrigadeMembers();
      fetchCities();
    }
  }, [user]);

  useEffect(() => {
    if (user && brigadeMembers.length >= 0) {
      fetchBookings();
    }
  }, [user, brigadeMembers, fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Helper functions
  const mapBackendStatus = (backendStatus) => {
    const statusMap = {
      'pending': 'Urmează',
      'completed': 'Finalizat', 
      'cancelled': 'Anulat'
    };
    
    return statusMap[backendStatus] || 'Urmează';
  };
  
  const mapFrontendStatus = (frontendStatus) => {
    const statusMap = {
      'Urmează': 'pending',
      'Finalizat': 'completed',
      'Anulat': 'cancelled'
    };
    
    return statusMap[frontendStatus] || 'pending';
  };

  const formatDateTime = (date, time) => {
    const dateObj = new Date(`${date}T${time}`);
    return moment(dateObj).format('DD MMMM YYYY, HH:mm');
  };

  const getStatusStyle = (status) => {
    const statusOption = statusOptions.find(option => option.value === status);
    if (!statusOption) return { icon: 'time', color: colors.textSecondary };
    return statusOption;
  };

  const getFileIcon = (mimetype) => {
    if (!mimetype) return 'document';
    if (mimetype.includes('pdf')) return 'document-text';
    if (mimetype.includes('image')) return 'image';
    if (mimetype.includes('word')) return 'document';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'stats-chart';
    return 'document';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
      setSelectedDocument({
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
        setSelectedDocument({
          uri: result.uri,
          name: result.name,
          type: result.mimeType || 'application/octet-stream',
        });
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const uploadDocument = async (bookingId) => {
    if (!selectedDocument) {
      Alert.alert('Eroare', 'Vă rugăm să selectați un document');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('document', {
        uri: selectedDocument.uri,
        name: selectedDocument.name,
        type: selectedDocument.type,
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
        `/cnas-services/${bookingId}/documents`,
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
        setSelectedDocument(null);
        
        // Reîncarcă booking-ul pentru a obține documentele actualizate
        if (currentBooking && currentBooking._id === bookingId) {
          fetchBookings();
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

  const downloadDocument = async (bookingId, documentId, documentName) => {
    try {
      Alert.alert(
        'Descărcare document',
        'Funcționalitatea de descărcare nu este disponibilă încă în versiunea mobile.',
        [{ text: 'OK' }]
      );
      // TODO: Implementare descărcare cu expo-file-system
    } catch (err) {
      console.error('Eroare la descărcare:', err);
      Alert.alert('Eroare', 'Nu s-a putut descărca documentul');
    }
  };

  const deleteDocument = async (bookingId, documentId) => {
    Alert.alert(
      'Confirmare ștergere',
      'Sigur doriți să ștergeți acest document?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/cnas-services/${bookingId}/documents/${documentId}`);
              Alert.alert('Succes', 'Documentul a fost șters');
              fetchBookings();
            } catch (err) {
              Alert.alert('Eroare', 'Nu s-a putut șterge documentul');
            }
          },
        },
      ]
    );
  };

  // Handlers
  const handleAddNewBooking = () => {
    const initialFormData = {
      patientName: '',
      pickupLocation: '',
      destinationLocation: '',
      bookingDate: new Date(),
      bookingTime: new Date(),
      notes: '',
      status: 'Urmează',
      brigadeEmployeeId: '',
      cityId: ''
    };
    
    if (!isAdmin && user.city) {
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      initialFormData.cityId = userCityId;
    }
    
    setFormData(initialFormData);
    setSelectedDocument(null);
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș pentru programare!');
        return;
      }
      
      const combinedDate = new Date(formData.bookingDate);
      combinedDate.setHours(formData.bookingTime.getHours());
      combinedDate.setMinutes(formData.bookingTime.getMinutes());
      
      const cnasServiceData = {
        patientName: formData.patientName,
        pickupPoint: formData.pickupLocation,
        dropoffPoint: formData.destinationLocation,
        city: formData.cityId,
        status: mapFrontendStatus(formData.status),
        notes: formData.notes,
        date: combinedDate
      };
      
      const response = await axios.post('/cnas-services', cnasServiceData);
      
      // Upload document if selected
      if (selectedDocument && response.data?.data?._id) {
        await uploadDocument(response.data.data._id);
      }
      
      Alert.alert('Succes', 'Programarea a fost adăugată cu succes!');
      setShowAddModal(false);
      fetchBookings();
      
    } catch (err) {
      console.error('Eroare la adăugare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga programarea');
    }
  };

  const handleEditInit = (booking) => {
    setFormData({
      patientName: booking.patientName,
      pickupLocation: booking.pickupLocation,
      destinationLocation: booking.destinationLocation,
      bookingDate: new Date(booking.bookingDate),
      bookingTime: new Date(`2000-01-01T${booking.bookingTime}`),
      notes: booking.notes || '',
      status: booking.status,
      cityId: booking.cityId,
      brigadeEmployeeId: booking.assistantId || ''
    });
    
    setBookingToEdit(booking);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      const combinedDate = new Date(formData.bookingDate);
      combinedDate.setHours(formData.bookingTime.getHours());
      combinedDate.setMinutes(formData.bookingTime.getMinutes());
      
      const cnasServiceData = {
        patientName: formData.patientName,
        pickupPoint: formData.pickupLocation,
        dropoffPoint: formData.destinationLocation,
        city: formData.cityId,
        status: mapFrontendStatus(formData.status),
        notes: formData.notes,
        date: combinedDate,
        assistant: formData.brigadeEmployeeId || undefined
      };
      
      await axios.put(`/cnas-services/${bookingToEdit._id}`, cnasServiceData);
      
      Alert.alert('Succes', 'Programarea a fost actualizată!');
      setShowEditModal(false);
      setBookingToEdit(null);
      fetchBookings();
      
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza');
    }
  };

  const handleViewBooking = (booking) => {
    setCurrentBooking(booking);
    setSelectedDocument(null);
    setShowViewModal(true);
  };

  const handleStatusInit = (booking) => {
    setBookingToUpdateStatus(booking);
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const backendStatus = mapFrontendStatus(newStatus);
      
      const updateData = {
        status: backendStatus
      };
      
      if (newStatus === 'Finalizat' && !isAdmin) {
        updateData.assistant = user._id;
      }
      
      await axios.put(`/cnas-services/${bookingToUpdateStatus._id}`, updateData);
      
      Alert.alert('Succes', `Statusul a fost actualizat la: ${newStatus}`);
      setShowStatusModal(false);
      setBookingToUpdateStatus(null);
      fetchBookings();
      
    } catch (err) {
      console.error('Eroare la actualizarea statusului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza statusul');
    }
  };

  const handleDelete = (booking) => {
    const message = booking.documents && booking.documents.length > 0
      ? `Sigur doriți să ștergeți programarea pentru ${booking.patientName}? Această programare are ${booking.documents.length} documente atașate care vor fi șterse permanent.`
      : `Sigur doriți să ștergeți programarea pentru ${booking.patientName}?`;
    
    Alert.alert(
      'Confirmare ștergere',
      message,
      [
        { text: 'Anulează', style: 'cancel' },
        { 
          text: 'Șterge', 
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/cnas-services/${booking._id}`);
              Alert.alert('Succes', 'Programarea a fost ștearsă');
              fetchBookings();
            } catch (err) {
              Alert.alert('Eroare', 'Nu s-a putut șterge programarea');
            }
          }
        }
      ]
    );
  };

  // Filtered bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      searchTerm === '' || 
      booking.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.pickupLocation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === '' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Render functions
  const renderBookingItem = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const hasDocuments = item.documents && item.documents.length > 0;
    
    return (
      <TouchableOpacity 
        style={styles.bookingCard}
        onPress={() => handleViewBooking(item)}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            {hasDocuments && (
              <View style={styles.documentBadge}>
                <Ionicons name="attach" size={14} color="#fff" />
                <Text style={styles.documentBadgeText}>{item.documents.length}</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.color }]}>
            <Ionicons name={statusStyle.icon} size={16} color="#fff" />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickupLocation}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.destinationLocation}
            </Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <View style={styles.footerLeft}>
            <Ionicons name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>
              {formatDateTime(item.bookingDate, item.bookingTime)}
            </Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.assistantRow}>
            <Ionicons name="person" size={14} color={colors.textSecondary} />
            <Text style={styles.assistantText}>{item.assistantName}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.info }]}
            onPress={() => handleStatusInit(item)}
          >
            <Ionicons name="sync" size={18} color="#fff" />
          </TouchableOpacity>
          
          {(isAdmin || item.assistantId === user._id) && (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.warning }]}
                onPress={() => handleEditInit(item)}
              >
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Caută pacient, locație..."
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
            {statusOptions.map(option => (
              <Picker.Item key={option.value} label={option.value} value={option.value} />
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
            <Text style={styles.modalTitle}>Adaugă programare CNAS</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume pacient *</Text>
            <TextInput
              style={styles.input}
              value={formData.patientName}
              onChangeText={(text) => setFormData({...formData, patientName: text})}
              placeholder="Ex: Ion Popescu"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Adresă preluare *</Text>
            <TextInput
              style={styles.input}
              value={formData.pickupLocation}
              onChangeText={(text) => setFormData({...formData, pickupLocation: text})}
              placeholder="Ex: Str. Principală nr. 10"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Adresă destinație *</Text>
            <TextInput
              style={styles.input}
              value={formData.destinationLocation}
              onChangeText={(text) => setFormData({...formData, destinationLocation: text})}
              placeholder="Ex: Spitalul Județean"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Data *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.bookingDate).format('DD.MM.YYYY')}
                  </Text></TouchableOpacity>
              </View>

              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Ora *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.bookingTime).format('HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>
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

            <Text style={styles.inputLabel}>Note (opțional)</Text>
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
                <Ionicons name="attach" size={18} color={colors.primary} /> Documente
              </Text>
              
              <View style={styles.uploadButtons}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={pickDocument}
                >
                  <Ionicons name="document" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Încarcă document</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={20} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Fă o poză</Text>
                </TouchableOpacity>
              </View>

              {selectedDocument && (
                <View style={styles.selectedDocument}>
                  <Ionicons 
                    name={getFileIcon(selectedDocument.type)} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.selectedDocumentName} numberOfLines={1}>
                    {selectedDocument.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDocument(null)}>
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

      {showDatePicker && (
        <DateTimePicker
          value={formData.bookingDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setFormData({...formData, bookingDate: selectedDate});
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={formData.bookingTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              setFormData({...formData, bookingTime: selectedTime});
            }
          }}
        />
      )}
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
            <Text style={styles.modalTitle}>Editează programare CNAS</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume pacient *</Text>
            <TextInput
              style={styles.input}
              value={formData.patientName}
              onChangeText={(text) => setFormData({...formData, patientName: text})}
              placeholder="Ex: Ion Popescu"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Adresă preluare *</Text>
            <TextInput
              style={styles.input}
              value={formData.pickupLocation}
              onChangeText={(text) => setFormData({...formData, pickupLocation: text})}
              placeholder="Ex: Str. Principală nr. 10"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Adresă destinație *</Text>
            <TextInput
              style={styles.input}
              value={formData.destinationLocation}
              onChangeText={(text) => setFormData({...formData, destinationLocation: text})}
              placeholder="Ex: Spitalul Județean"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Data *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.bookingDate).format('DD.MM.YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Ora *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.bookingTime).format('HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>Status *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
                style={styles.picker}
              >
                {statusOptions.map(option => (
                  <Picker.Item key={option.value} label={option.value} value={option.value} />
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

            {isAdmin && (
              <>
                <Text style={styles.inputLabel}>Asistent</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.brigadeEmployeeId}
                    onValueChange={(value) => setFormData({...formData, brigadeEmployeeId: value})}
                    style={styles.picker}
                  >
                    <Picker.Item label="Nealocat" value="" />
                    {brigadeMembers.map(member => (
                      <Picker.Item 
                        key={member._id} 
                        label={`${member.name} (${member.city})`} 
                        value={member._id} 
                      />
                    ))}
                  </Picker>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Note (opțional)</Text>
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
                Documentele pot fi gestionate din vizualizarea detaliată a programării.
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
            <Text style={styles.modalTitle}>Detalii programare CNAS</Text>
            <TouchableOpacity onPress={() => setShowViewModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {currentBooking && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informații pacient</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentBooking.patientName}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Locații</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                  <Text style={styles.detailText}>{currentBooking.pickupLocation}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentBooking.destinationLocation}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Programare</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {formatDateTime(currentBooking.bookingDate, currentBooking.bookingTime)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentBooking.city}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status & Asistent</Text>
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getStatusStyle(currentBooking.status).icon} 
                    size={18} 
                    color={getStatusStyle(currentBooking.status).color} 
                  />
                  <Text style={styles.detailText}>{currentBooking.status}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={18} color={colors.info} />
                  <Text style={styles.detailText}>{currentBooking.assistantName}</Text>
                </View>
              </View>

              {currentBooking.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Note</Text>
                  <Text style={styles.detailText}>{currentBooking.notes}</Text>
                </View>
              )}

              {/* Documents Section */}
              <View style={styles.detailSection}>
                <View style={styles.documentHeader}>
                  <Text style={styles.detailSectionTitle}>Documente</Text>
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

                {selectedDocument && (
                  <View style={styles.uploadProgress}>
                    <View style={styles.selectedDocument}>
                      <Ionicons 
                        name={getFileIcon(selectedDocument.type)} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={styles.selectedDocumentName} numberOfLines={1}>
                        {selectedDocument.name}
                      </Text>
                    </View>
                    <View style={styles.uploadActions}>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.primary }]}
                        onPress={() => uploadDocument(currentBooking._id)}
                        disabled={isUploading}
                      >
                        <Text style={styles.uploadActionText}>
                          {isUploading ? 'Se încarcă...' : 'Încarcă'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.uploadActionButton, { backgroundColor: colors.error }]}
                        onPress={() => setSelectedDocument(null)}
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

                {currentBooking.documents && currentBooking.documents.length > 0 ? (
                  <View style={styles.documentsList}>
                    {currentBooking.documents.map((doc, index) => (
                      <View key={doc._id || index} style={styles.documentItem}>
                        <View style={styles.documentInfo}>
                          <Ionicons 
                            name={getFileIcon(doc.mimetype)} 
                            size={20} 
                            color={colors.primary} 
                          />
                          <View style={styles.documentDetails}>
                            <Text style={styles.documentName} numberOfLines={1}>
                              {doc.name || 'Document'}
                            </Text>
                            <Text style={styles.documentSize}>
                              {formatFileSize(doc.size)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.documentItemActions}>
                          <TouchableOpacity 
                            style={styles.documentItemButton}
                            onPress={() => downloadDocument(currentBooking._id, doc._id, doc.name)}
                          >
                            <Ionicons name="download" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.documentItemButton}
                            onPress={() => deleteDocument(currentBooking._id, doc._id)}
                          >
                            <Ionicons name="trash" size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDocuments}>
                    <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.noDocumentsText}>
                      Nu există documente atașate
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

          {bookingToUpdateStatus && (
            <View style={styles.modalBody}>
              <Text style={styles.statusModalText}>
                Actualizați statusul pentru programarea pacientului{' '}
                <Text style={styles.boldText}>{bookingToUpdateStatus.patientName}</Text>:
              </Text>

              <View style={styles.statusOptions}>
                {statusOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.statusOption,
                      { backgroundColor: option.color }
                    ]}
                    onPress={() => handleStatusUpdate(option.value)}
                  >
                    <Ionicons name={option.icon} size={24} color="#fff" />
                    <Text style={styles.statusOptionText}>{option.value}</Text>
                  </TouchableOpacity>
                ))}
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
        <Text style={styles.loadingText}>Se încarcă programările CNAS...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchBookings}>
          <Text style={styles.retryButtonText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilters()}
      
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingItem}
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
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Nu există programări CNAS</Text>
            <TouchableOpacity 
              style={styles.addFirstButton}
              onPress={handleAddNewBooking}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addFirstButtonText}>Adaugă prima programare</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddNewBooking}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {renderAddModal()}
      {renderEditModal()}
      {renderViewModal()}
      {renderStatusModal()}
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
  
  // Booking Card
  bookingCard: {
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
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  patientInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientName: {
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
  locationContainer: {
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  locationText: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontSize: 14,
  },
  bookingFooter: {
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
  dateText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 12,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  assistantText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 14,
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
  },textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 15,
  },
  dateTimeContainer: {
    flex: 1,
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
  
  // Document Section
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 10,
    color: colors.text,
    fontSize: 14,
    flex: 1,
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
  documentsList: {
    marginTop: 10,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentDetails: {
    marginLeft: 10,
    flex: 1,
  },
  documentName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  documentSize: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  documentItemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  documentItemButton: {
    padding: 8,
  },
  noDocuments: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
  },
  noDocumentsText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
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
});

export default CNASBookingsScreen;