// src/screens/events/EventsScreen.js
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

const EventsScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [brigadeMembers, setBrigadeMembers] = useState([]);
  const [cities, setCities] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [eventToUpdateStatus, setEventToUpdateStatus] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [showDocumentDeleteConfirm, setShowDocumentDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  
  // Document states
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date'); // 'date', 'time', 'filter'
  
  const [formData, setFormData] = useState({
    eventName: '',
    eventDate: new Date(),
    eventTime: new Date(),
    ambulanceType: 'B1',
    notes: '',
    status: 'Urmează',
    cityId: '',
    brigadeEmployeeId: ''
  });

  const ambulanceTypes = [
    { value: 'B1', label: 'B1 - Ambulanță de prim ajutor' },
    { value: 'B2', label: 'B2 - Ambulanță de consultații' }
  ];

  const statusOptions = [
    { value: 'Finalizat', icon: 'checkmark-circle', color: colors.success },
    { value: 'Urmează', icon: 'time', color: colors.primary },
    { value: 'Anulat', icon: 'close-circle', color: colors.error }
  ];

  // Fetch functions
  const fetchEvents = useCallback(async () => {
    try {
      const response = await axios.get('/event-services');
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const eventsData = await Promise.all(response.data.data.map(async event => {
          // Format date and time
          const eventDate = new Date(event.date);
          const formattedDate = eventDate.toISOString().split('T')[0];
          const formattedTime = eventDate.toTimeString().slice(0, 5);
          
          // Extract city name and ID
          let cityName = 'Necunoscut';
          let cityId = null;
          
          if (event.city) {
            if (typeof event.city === 'object') {
              cityName = event.city.name || 'Necunoscut';
              cityId = event.city._id;
            } else if (typeof event.city === 'string') {
              cityId = event.city;
              if (cityId === '6823053af3c9fed99da59f39') {
                cityName = 'Suceava';
              } else if (cityId === '6823053af3c9fed99da59f3a') {
                cityName = 'Botoșani';
              }
            }
          }
          
          // Extract assistant name
          let assistantName = 'Nealocat';
          let assistantId = null;
          
          if (event.assistant) {
            if (typeof event.assistant === 'object') {
              assistantName = event.assistant.name || 'Nealocat';
              assistantId = event.assistant._id;
            } else if (typeof event.assistant === 'string') {
              assistantId = event.assistant;
              
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
          
          // Process documents
          const documents = event.documents || [];
          
          return {
            _id: event._id,
            eventName: event.eventName,
            eventDate: formattedDate,
            eventTime: formattedTime,
            ambulanceType: event.ambulanceType,
            city: cityName,
            cityId,
            assistantName,
            assistantId,
            status: mapBackendStatus(event.status),
            notes: event.notes,
            documents,
          };
        }));
        
        const userCityId = user.city && typeof user.city === 'object' 
          ? user.city._id 
          : typeof user.city === 'string' 
            ? user.city 
            : null;
            
        const filteredEvents = isAdmin 
          ? eventsData 
          : eventsData.filter(event => event.cityId === userCityId);
        
        setEvents(filteredEvents);
      } else {
        setEvents([]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Eroare la încărcarea evenimentelor:', err);
      setError(err.response?.data?.message || 'Nu s-au putut obține evenimentele');
      setEvents([]);
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
            : typeof user.city === 'string' 
              ? (user.city === '6823053af3c9fed99da59f39' ? 'Suceava' : 
                 user.city === '6823053af3c9fed99da59f3a' ? 'Botoșani' : 'Oraș necunoscut')
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
      } else {
        setBrigadeMembers([]);
      }
    } catch (err) {
      console.error('Eroare la încărcarea membrilor brigăzii:', err);
      
      // Fallback to hardcoded members
      const hardcodedMembers = [
        {
          _id: '6823058e27708a015183058c',
          name: 'Claudiu', 
          city: 'Suceava',
          cityId: '6823053af3c9fed99da59f39'
        }
      ];
      
      const filteredMembers = isAdmin 
        ? hardcodedMembers 
        : hardcodedMembers.filter(member => {
            const userCityId = user.city && typeof user.city === 'object' 
              ? user.city._id 
              : typeof user.city === 'string' 
                ? user.city
                : null;
                
            return member.cityId === userCityId;
          });
      
      setBrigadeMembers(filteredMembers);
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
        
        if (!isAdmin && user.city) {
          const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
          setFormData(prevData => ({
            ...prevData,
            cityId: userCityId
          }));
        }
      }
    } catch (err) {
      console.error('Eroare la încărcarea orașelor:', err);
      
      const hardcodedCities = [
        { _id: '6823053af3c9fed99da59f39', name: 'Suceava' },
        { _id: '6823053af3c9fed99da59f3a', name: 'Botoșani' }
      ];
      
      setCities(hardcodedCities);
      
      if (!isAdmin && user.city) {
        const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
        setFormData(prevData => ({
          ...prevData,
          cityId: userCityId
        }));
      }
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
      fetchEvents();
    }
  }, [user, brigadeMembers, fetchEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
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

  const uploadDocument = async (eventId) => {
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
        `/event-services/${eventId}/documents`,
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
        
        // Reload event to get updated documents
        if (currentEvent && currentEvent._id === eventId) {
          fetchEvents();
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

  const downloadDocument = async (eventId, documentId, documentName) => {
    try {
      Alert.alert(
        'Descărcare document',
        'Funcționalitatea de descărcare nu este disponibilă încă în versiunea mobile.',
        [{ text: 'OK' }]
      );
      // TODO: Implement download with expo-file-system
    } catch (err) {
      console.error('Eroare la descărcare:', err);
      Alert.alert('Eroare', 'Nu s-a putut descărca documentul');
    }
  };

  const handleDeleteDocumentInit = (eventId, documentId) => {
    setDocumentToDelete({ eventId, documentId });
    setShowDocumentDeleteConfirm(true);
  };

  const handleDeleteDocumentConfirm = async () => {
    try {
      const { eventId, documentId } = documentToDelete;
      
      await axios.delete(`/event-services/${eventId}/documents/${documentId}`);
      
      if (currentEvent && currentEvent._id === eventId) {
        setCurrentEvent({
          ...currentEvent,
          documents: currentEvent.documents.filter(doc => doc._id !== documentId)
        });
      }
      
      setEvents(prevEvents => 
        prevEvents.map(e => {
          if (e._id === eventId) {
            return {
              ...e,
              documents: (e.documents || []).filter(doc => doc._id !== documentId)
            };
          }
          return e;
        })
      );
      
      setShowDocumentDeleteConfirm(false);
      setDocumentToDelete(null);
      
      Alert.alert('Succes', 'Documentul a fost șters');
    } catch (err) {
      console.error('Eroare la ștergerea documentului:', err);
      Alert.alert('Eroare', 'Nu s-a putut șterge documentul');
      setShowDocumentDeleteConfirm(false);
    }
  };

  // Handlers
  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAddNewEvent = () => {
    const now = new Date();
    const initialFormData = {
      eventName: '',
      eventDate: now,
      eventTime: now,
      ambulanceType: 'B1',
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
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș pentru eveniment!');
        return;
      }
      
      const combinedDate = new Date(formData.eventDate);
      combinedDate.setHours(formData.eventTime.getHours());
      combinedDate.setMinutes(formData.eventTime.getMinutes());
      
      const eventData = {
        eventName: formData.eventName,
        city: formData.cityId,
        status: mapFrontendStatus(formData.status),
        ambulanceType: formData.ambulanceType,
        notes: formData.notes,
        date: combinedDate.toISOString()
      };
      
      const response = await axios.post('/event-services', eventData);
      
      // Upload document if selected
      if (selectedDocument && response.data?.data?._id) {
        await uploadDocument(response.data.data._id);
      }
      
      Alert.alert('Succes', 'Evenimentul a fost adăugat cu succes!');
      setShowAddModal(false);
      fetchEvents();
      
    } catch (err) {
      console.error('Eroare la adăugare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga evenimentul');
    }
  };

  const handleViewEvent = (event) => {
    setCurrentEvent(event);
    setSelectedDocument(null);
    setShowViewModal(true);
  };

  const handleEditInit = (event) => {
    // Create date objects from strings
    const eventDate = new Date(event.eventDate);
    const eventTime = new Date(`2000-01-01T${event.eventTime}`);
    
    setFormData({
      eventName: event.eventName,
      eventDate: eventDate,
      eventTime: eventTime,
      ambulanceType: event.ambulanceType,
      notes: event.notes || '',
      status: event.status,
      cityId: event.cityId,
      brigadeEmployeeId: event.assistantId || ''
    });
    
    setEventToEdit(event);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    try {
      if (!formData.cityId) {
        Alert.alert('Eroare', 'Vă rugăm să selectați un oraș!');
        return;
      }
      
      const combinedDate = new Date(formData.eventDate);
      combinedDate.setHours(formData.eventTime.getHours());
      combinedDate.setMinutes(formData.eventTime.getMinutes());
      
      const eventData = {
        eventName: formData.eventName,
        city: formData.cityId,
        status: mapFrontendStatus(formData.status),
        ambulanceType: formData.ambulanceType,
        notes: formData.notes,
        date: combinedDate.toISOString(),
        assistant: formData.brigadeEmployeeId || undefined
      };
      
      await axios.put(`/event-services/${eventToEdit._id}`, eventData);
      
      Alert.alert('Succes', 'Evenimentul a fost actualizat!');
      setShowEditModal(false);
      setEventToEdit(null);
      fetchEvents();
      
    } catch (err) {
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza');
    }
  };

  const handleDeleteInit = (event) => {
    setEventToDelete(event);
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`/event-services/${eventToDelete._id}`);
      
      setEvents(events.filter(e => e._id !== eventToDelete._id));
      
      setShowDeleteConfirm(false);
      setEventToDelete(null);
      
      Alert.alert('Succes', 'Evenimentul a fost șters');
    } catch (err) {
      console.error('Eroare la ștergere:', err);
      Alert.alert('Eroare', 'Nu s-a putut șterge evenimentul');
      setShowDeleteConfirm(false);
    }
  };

  const handleStatusInit = (event) => {
    setEventToUpdateStatus(event);
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
      
      await axios.put(`/event-services/${eventToUpdateStatus._id}`, updateData);
      
      Alert.alert('Succes', `Statusul a fost actualizat la: ${newStatus}`);
      setShowStatusModal(false);
      setEventToUpdateStatus(null);
      fetchEvents();
      
    } catch (err) {
      console.error('Eroare la actualizarea statusului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut actualiza statusul');
    }
  };

  // Filtered events
  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      searchTerm === '' || 
      event.eventName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCity = cityFilter === '' || event.city === cityFilter;
    
    const matchesDate = dateFilter === '' || 
      event.eventDate === dateFilter;
    
    const matchesStatus = statusFilter === '' || event.status === statusFilter;
    
    return matchesSearch && matchesCity && matchesDate && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(`${a.eventDate}T${a.eventTime}`);
      const dateB = new Date(`${b.eventDate}T${b.eventTime}`);
      return sortOrder === 'asc' 
        ? dateA - dateB 
        : dateB - dateA;
    } else if (sortBy === 'eventName') {
      return sortOrder === 'asc'
        ? a.eventName.localeCompare(b.eventName)
        : b.eventName.localeCompare(a.eventName);
    }
    return 0;
  });

  // Render functions
  const renderEventItem = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const hasDocuments = item.documents && item.documents.length > 0;
    
    return (
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => handleViewEvent(item)}
      >
        <View style={styles.eventHeader}>
          <View style={styles.eventNameContainer}>
            <Text style={styles.eventName}>{item.eventName}</Text>
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

        <View style={styles.eventDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.detailText}>
              {formatDateTime(item.eventDate, item.eventTime)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.ambulanceType}</Text>
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

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Caută eveniment..."
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
                  {statusOptions.map(option => (
                    <Picker.Item key={option.value} label={option.value} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>
            
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
                    <Picker.Item label="Suceava" value="Suceava" />
                    <Picker.Item label="Botoșani" value="Botoșani" />
                  </Picker>
                </View>
              </View>
            )}
          </View>

          <View style={styles.filterRow}>
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
            
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Sortează după:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={sortBy}
                  onValueChange={setSortBy}
                  style={styles.picker}
                >
                  <Picker.Item label="Data și ora" value="date" />
                  <Picker.Item label="Nume eveniment" value="eventName" />
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity 
              style={styles.sortOrderButton}
              onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <Ionicons 
                name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={18} 
                color={colors.primary} 
              />
              <Text style={styles.sortOrderText}>
                {sortOrder === 'asc' ? 'Crescător' : 'Descrescător'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.resetFiltersButton}
              onPress={() => {
                setSearchTerm('');
                setCityFilter('');
                setDateFilter('');
                setStatusFilter('');
                setSortBy('date');
                setSortOrder('desc');
              }}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.resetFiltersText}>Resetează filtre</Text>
            </TouchableOpacity>
          </View>
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
            <Text style={styles.modalTitle}>Adaugă Eveniment</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume eveniment *</Text>
            <TextInput
              style={styles.input}
              value={formData.eventName}
              onChangeText={(text) => handleInputChange('eventName', text)}
              placeholder="Ex: Festivalul de Toamnă"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeContainer}>
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
                    {moment(formData.eventDate).format('DD.MM.YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Ora *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setDatePickerMode('time');
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.eventTime).format('HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>Tip ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.ambulanceType}
                onValueChange={(value) => handleInputChange('ambulanceType', value)}
                style={styles.picker}
              >
                {ambulanceTypes.map(type => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
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
            <Text style={styles.modalTitle}>Editează Eveniment</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Nume eveniment *</Text>
            <TextInput
              style={styles.input}
              value={formData.eventName}
              onChangeText={(text) => handleInputChange('eventName', text)}
              placeholder="Ex: Festivalul de Toamnă"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeContainer}>
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
                    {moment(formData.eventDate).format('DD.MM.YYYY')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeContainer}>
                <Text style={styles.inputLabel}>Ora *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setDatePickerMode('time');
                    setShowTimePicker(true);
                  }}
                >
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {moment(formData.eventTime).format('HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>Tip ambulanță *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.ambulanceType}
                onValueChange={(value) => handleInputChange('ambulanceType', value)}
                style={styles.picker}
              >
                {ambulanceTypes.map(type => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Status *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
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

            {isAdmin && (
              <>
                <Text style={styles.inputLabel}>Asistent</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.brigadeEmployeeId}
                    onValueChange={(value) => handleInputChange('brigadeEmployeeId', value)}
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
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Note adiționale..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Documentele pot fi gestionate din vizualizarea detaliată a evenimentului.
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
            <Text style={styles.modalTitle}>Detalii Eveniment</Text>
            <TouchableOpacity onPress={() => setShowViewModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {currentEvent && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Informații Eveniment</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentEvent.eventName}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Programare</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {formatDateTime(currentEvent.eventDate, currentEvent.eventTime)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="car" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentEvent.ambulanceType}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{currentEvent.city}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status & Asistent</Text>
                <View style={styles.detailRow}>
                  <Ionicons 
                    name={getStatusStyle(currentEvent.status).icon} 
                    size={18} 
                    color={getStatusStyle(currentEvent.status).color} 
                  />
                  <Text style={styles.detailText}>{currentEvent.status}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={18} color={colors.info} />
                  <Text style={styles.detailText}>{currentEvent.assistantName}</Text>
                </View>
              </View>

              {currentEvent.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Note</Text>
                  <Text style={styles.detailText}>{currentEvent.notes}</Text>
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
                        onPress={() => uploadDocument(currentEvent._id)}
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

                {currentEvent.documents && currentEvent.documents.length > 0 ? (
                  <View style={styles.documentsList}>
                    {currentEvent.documents.map((doc, index) => (
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
                            onPress={() => downloadDocument(currentEvent._id, doc._id, doc.name)}
                          >
                            <Ionicons name="download" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.documentItemButton}
                            onPress={() => handleDeleteDocumentInit(currentEvent._id, doc._id)}
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

          {eventToUpdateStatus && (
            <View style={styles.modalBody}>
              <Text style={styles.statusModalText}>
                Actualizați statusul pentru evenimentul{' '}
                <Text style={styles.boldText}>{eventToUpdateStatus.eventName}</Text>:
              </Text>

              <View style={styles.userInfoPanel}>
                <Text style={styles.userName}>
                  <Text style={styles.boldText}>{user.name}</Text> {user.role === 'admin' ? '(Administrator)' : '(Asistent)'}
                </Text>
                <Text style={styles.userDetails}>
                  <Text style={styles.smallText}>Oraș: {typeof user.city === 'object' ? user.city.name : 
                              (typeof user.city === 'string' && user.city === '6823053af3c9fed99da59f39') ? 'Suceava' :
                              (typeof user.city === 'string' && user.city === '6823053af3c9fed99da59f3a') ? 'Botoșani' : 
                              'Necunoscut'}</Text>
                </Text>
              </View>

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
          
          {eventToDelete && (
            <View style={styles.modalBody}>
              <Text style={styles.confirmText}>
                Sunteți sigur că doriți să ștergeți evenimentul <Text style={styles.boldText}>{eventToDelete.eventName}</Text> din data <Text style={styles.boldText}>{formatDateTime(eventToDelete.eventDate, eventToDelete.eventTime)}</Text>?
              </Text>
              
              {eventToDelete.documents && eventToDelete.documents.length > 0 && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={styles.warningText}>
                    Acest eveniment are {eventToDelete.documents.length} documente atașate care vor fi șterse permanent.
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
                  <Text style={styles.deleteButtonText}>Șterge eveniment</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderDocumentDeleteConfirmModal = () => (
    <Modal
      visible={showDocumentDeleteConfirm}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDocumentDeleteConfirm(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.confirmModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmare ștergere document</Text>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.confirmText}>
              Sunteți sigur că doriți să ștergeți acest document? Această acțiune este permanentă și nu poate fi anulată.
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowDocumentDeleteConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Anulează</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, styles.deleteButton]}
                onPress={handleDeleteDocumentConfirm}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.deleteButtonText}>Șterge document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă evenimentele...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchEvents}>
         <Text style={styles.retryButtonText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilters()}
      
      <FlatList
        data={filteredEvents}
        renderItem={renderEventItem}
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
            <Text style={styles.emptyText}>Nu există evenimente</Text>
            <TouchableOpacity 
              style={styles.addFirstButton}
              onPress={handleAddNewEvent}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addFirstButtonText}>Adaugă primul eveniment</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={handleAddNewEvent}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {renderAddModal()}
      {renderEditModal()}
      {renderViewModal()}
      {renderStatusModal()}
      {renderDeleteConfirmModal()}
      {renderDocumentDeleteConfirmModal()}
      
      {/* Date Picker for form date field */}
      {showDatePicker && datePickerMode === 'date' && (
        <DateTimePicker
          value={formData.eventDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              handleInputChange('eventDate', selectedDate);
            }
          }}
        />
      )}
      
      {/* Time Picker for form time field */}
      {showTimePicker && datePickerMode === 'time' && (
        <DateTimePicker
          value={formData.eventTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              handleInputChange('eventTime', selectedTime);
            }
          }}
        />
      )}
      
      {/* Date Picker for filter */}
      {showDatePicker && datePickerMode === 'filter' && (
        <DateTimePicker
          value={dateFilter ? new Date(dateFilter) : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDateFilter(selectedDate.toISOString().split('T')[0]);
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
  
  // Filters
  filtersContainer: {
    padding: 15,
    backgroundColor: colors.card,
    elevation: 2,
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
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    padding: 10,
    borderRadius: 8,
  },
  dateFilterText: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  clearDateButton: {
    padding: 4,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sortOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
  },
  sortOrderText: {
    marginLeft: 5,
    color: colors.primary,
    fontWeight: '500',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
  },
  resetFiltersText: {
    marginLeft: 5,
    color: colors.primary,
    fontWeight: '500',
  },
  
  // List
  listContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  
  // Event Card
  eventCard: {
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
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 8,
  },
  documentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  eventDetails: {
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
    minHeight: 80,
    textAlignVertical: 'top',
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
  smallText: {
    fontSize: 12,
  },
  userInfoPanel: {
    backgroundColor: colors.info + '20',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    padding: 12,
    marginBottom: 20,
  },
  userName: {
    fontSize: 16,
    color: colors.text,
  },
  userDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
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

  // Confirm Modal
  confirmText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
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
});

export default EventsScreen;