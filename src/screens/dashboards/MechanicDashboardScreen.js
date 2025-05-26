import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  Platform,
  FlatList,
  Modal,
  TextInput,
  Image
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axios from '../../utils/axios';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';
import * as ImagePicker from 'expo-image-picker';

// Componenta pentru statistici
const StatsCard = ({ icon, value, label, footer, iconBgColor }) => {
  return (
    <View style={styles.statsCard}>
      <View style={[styles.statsIcon, { backgroundColor: iconBgColor || colors.primary }]}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
      {footer && (
        <Text style={styles.statsFooter}>{footer}</Text>
      )}
    </View>
  );
};

// Componenta pentru afișarea unei lucrări de mentenanță
const MaintenanceItem = ({ maintenance, onCompletePress }) => {
  const getStatusColor = () => {
    switch (maintenance.status) {
      case 'pending':
        return colors.warning;
      case 'in-progress':
        return colors.info;
      case 'completed':
        return colors.success;
      case 'critical':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <View style={styles.maintenanceItem}>
      <View style={styles.maintenanceHeader}>
        <Text style={styles.maintenanceTitle}>{maintenance.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{maintenance.statusText}</Text>
        </View>
      </View>

      <View style={styles.maintenanceDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="car" size={16} color={colors.textSecondary} style={styles.detailIcon} />
          <Text style={styles.detailText}>{maintenance.vehicle}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={colors.textSecondary} style={styles.detailIcon} />
          <Text style={styles.detailText}>{maintenance.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="speedometer" size={16} color={colors.textSecondary} style={styles.detailIcon} />
          <Text style={styles.detailText}>{maintenance.km} km</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} style={styles.detailIcon} />
          <Text style={styles.detailText}>{maintenance.date}</Text>
        </View>
      </View>

      <Text style={styles.maintenanceDescription}>
        {maintenance.description.length > 150 
          ? maintenance.description.substring(0, 150) + '...' 
          : maintenance.description}
      </Text>

      {maintenance.status !== 'completed' && (
        <TouchableOpacity 
          style={styles.completeButton}
          onPress={() => onCompletePress(maintenance)}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.completeButtonText}>Finalizează</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Componenta principală pentru dashboard-ul mecanicului
const MechanicDashboardScreen = () => {
  const { user } = useSelector(state => state.auth);
  const navigation = useNavigation();
  const isAdmin = user?.role === 'admin';
  const isMechanic = user?.role === 'mechanic';

  const [serviceRecords, setServiceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceStats, setServiceStats] = useState({
    pending: 0,
    'in-progress': 0,
    completed: 0,
    cancelled: 0,
    critical: 0,
    total: 0
  });

  // State pentru formular
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    vehicle: '',
    title: '',
    description: '',
    km: '',
    status: 'pending',
    partsReplaced: '',
    partsCost: 0,
    nextServiceKm: '',
    notes: ''
  });
  
  // State pentru modal finalizare
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [completeData, setCompleteData] = useState({
    partsReplaced: '',
    partsCost: ''
  });
  const [problemFile, setProblemFile] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  // Funcție pentru a reîmprospăta datele
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchVehicles(),
      fetchServiceStats(),
      fetchRecentServiceRecords()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      fetchVehicles();
      fetchServiceStats();
      fetchRecentServiceRecords();
    }
  }, [user]);

  // Obține vehiculele din baza de date
  const fetchVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const res = await axios.get('/api/vehicles');
      const all = res.data.data || [];
      const processed = all.map(v => ({
        _id: v._id,
        plateNumber: v.plateNumber,
        model: v.model || 'N/A',
        type: v.type || 'N/A',
        city: typeof v.city === 'object' ? v.city.name : 'Necunoscut',
        cityId: typeof v.city === 'object' ? v.city._id : v.city
      }));
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      setVehicles(isAdmin ? processed : processed.filter(v => v.cityId === userCityId));
    } catch (err) {
      console.error('Eroare la încărcarea vehiculelor:', err);
      setVehicles([]);
    }
    setLoadingVehicles(false);
  };

  // Obține statisticile despre lucrările de service
  const fetchServiceStats = async () => {
    try {
      const res = await axios.get('/api/ambulance-service/stats');
      setServiceStats(res.data.data);
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor:', err);
    }
  };

  // Obține înregistrările recente de service
  const fetchRecentServiceRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ambulance-service?limit=5&sort=-date');
      const recs = res.data.data || [];
      setServiceRecords(
        recs.map(r => ({
          id: r._id,
          title: r.title,
          vehicle: r.vehicle?.plateNumber || 'N/A',
          location: r.city?.name || 'Necunoscut',
          km: r.km,
          status: r.status,
          statusText: getStatusText(r.status),
          description: r.description,
          image: r.problemImage
            ? `/uploads/${r.problemImage.replace(/^uploads\//, '')}`
            : null,
          date: new Date(r.date).toISOString().split('T')[0],
          partsReplaced: r.partsReplaced,
          partsCost: r.partsCost
        }))
      );
    } catch (err) {
      console.error('Eroare la încărcarea înregistrărilor:', err);
      setServiceRecords([]);
    }
    setLoading(false);
  };

  // Obține textul pentru status
  const getStatusText = status => {
    switch (status) {
      case 'pending':
        return 'În așteptare';
      case 'in-progress':
        return 'În lucru';
      case 'completed':
        return 'Finalizat';
      case 'cancelled':
        return 'Anulat';
      case 'critical':
        return 'Critic';
      default:
        return 'Necunoscut';
    }
  };

  // Gestionează modificarea datelor din formular
  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Gestionează trimiterea formularului
  const handleSubmit = async () => {
    if (!formData.vehicle || !formData.title || !formData.description || !formData.km) {
      Alert.alert('Eroare', 'Completați toate câmpurile obligatorii');
      return;
    }

    try {
      const userCityId = typeof user.city === 'object' ? user.city._id : user.city;
      const payload = {
        ...formData,
        km: parseInt(formData.km, 10),
        partsCost: parseFloat(formData.partsCost) || 0,
        city: userCityId,
        assignedTo: isMechanic ? user._id : null
      };
      await axios.post('/api/ambulance-service', payload);
      setFormData({
        vehicle: '',
        title: '',
        description: '',
        km: '',
        status: 'pending',
        partsReplaced: '',
        partsCost: 0,
        nextServiceKm: '',
        notes: ''
      });
      setShowAddModal(false);
      fetchServiceStats();
      fetchRecentServiceRecords();
      Alert.alert('Succes', 'Lucrarea a fost adăugată cu succes');
    } catch (err) {
      console.error('Eroare la adăugare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut adăuga înregistrarea');
    }
  };

  // Deschide modal pentru finalizarea unei lucrări
  const openCompleteModal = (record) => {
    setSelectedRecord(record);
    setCompleteData({
      partsReplaced: record.partsReplaced || '',
      partsCost: record.partsCost || ''
    });
    setProblemFile(null);
    setReceiptFile(null);
    setShowCompleteModal(true);
  };

  // Închide modalul de finalizare
  const closeCompleteModal = () => {
    setShowCompleteModal(false);
    setSelectedRecord(null);
  };

  // Gestionează finalizarea lucrării
  const handleCompleteSubmit = async () => {
    try {
      await axios.put(`/api/ambulance-service/${selectedRecord.id}`, {
        status: 'completed',
        partsReplaced: completeData.partsReplaced,
        partsCost: parseFloat(completeData.partsCost) || 0
      });

      if (problemFile) {
        const formData = new FormData();
        formData.append('problem', {
          uri: problemFile.uri,
          type: 'image/jpeg',
          name: 'problem.jpg'
        });
        await axios.post(
          `/api/ambulance-service/${selectedRecord.id}/upload-problem-image`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      if (receiptFile) {
        const formData = new FormData();
        formData.append('receipt', {
          uri: receiptFile.uri,
          type: 'image/jpeg',
          name: 'receipt.jpg'
        });
        await axios.post(
          `/api/ambulance-service/${selectedRecord.id}/upload-receipt`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      fetchServiceStats();
      fetchRecentServiceRecords();
      closeCompleteModal();
      Alert.alert('Succes', 'Lucrarea a fost finalizată cu succes');
    } catch (err) {
      console.error('Eroare la finalizare:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut finaliza lucrarea');
    }
  };

  // Gestionează selectarea unei imagini
  const pickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'problem') {
        setProblemFile(result.assets[0]);
      } else {
        setReceiptFile(result.assets[0]);
      }
    }
  };

  // Navigare către toate înregistrările
  const handleViewAllServiceRecords = () => {
    navigation.navigate('MechanicService');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard Mecanic</Text>
          <Text style={styles.headerSubtitle}>Sistem de management al mentenanței Ambu-Life</Text>
        </View>

        {/* Stats cards */}
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <StatsCard
              icon="warning"
              value={serviceStats.critical.toString()}
              label="Probleme critice"
              footer="Necesită intervenție imediată"
              iconBgColor={colors.error}
            />
            <StatsCard
              icon="time"
              value={(serviceStats.pending + serviceStats['in-progress']).toString()}
              label="Întrețineri în așteptare"
              footer="Necesită atenție"
              iconBgColor={colors.warning}
            />
            <StatsCard
              icon="checkmark-circle"
              value={serviceStats.completed.toString()}
              label="Lucrări finalizate"
              footer="Total înregistrate"
              iconBgColor={colors.success}
            />
            <StatsCard
              icon="car"
              value={vehicles.length.toString()}
              label="Vehicule active"
              footer="În flotă"
              iconBgColor={colors.info}
            />
          </ScrollView>
        </View>

        {/* Acțiuni rapide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Adaugă lucrare</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={handleViewAllServiceRecords}
            >
              <Ionicons name="list" size={24} color={colors.info} />
              <Text style={styles.quickActionText}>Vezi toate</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => onRefresh()}
            >
              <Ionicons name="refresh" size={24} color={colors.success} />
              <Text style={styles.quickActionText}>Actualizează</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigation.navigate('VehicleList')}
            >
              <Ionicons name="car" size={24} color={colors.warning} />
              <Text style={styles.quickActionText}>Vehicule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Probleme recente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Probleme recente</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Se încarcă înregistrările...</Text>
            </View>
          ) : serviceRecords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nu există înregistrări de service.</Text>
            </View>
          ) : (
            <View style={styles.maintenanceList}>
              {serviceRecords.map(record => (
                <MaintenanceItem 
                  key={record.id} 
                  maintenance={record} 
                  onCompletePress={openCompleteModal} 
                />
              ))}
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={handleViewAllServiceRecords}
              >
                <Text style={styles.viewAllButtonText}>Vezi toate lucrările</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal pentru adăugarea unei noi lucrări */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adaugă lucrare nouă</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ambulanță *</Text>
                <TouchableOpacity 
                  style={styles.pickerButton}
                  onPress={() => setShowVehiclePicker(true)}
                >
                  <Text style={[
                    styles.pickerButtonText, 
                    !formData.vehicle && styles.pickerPlaceholder
                  ]}>
                    {formData.vehicle 
                      ? vehicles.find(v => v._id === formData.vehicle)?.plateNumber || "Selectează ambulanța"
                      : "Selectează ambulanța"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Titlu lucrare / problemă *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Schimb ulei, Înlocuire plăcuțe frână, etc."
                  value={formData.title}
                  onChangeText={(text) => handleInputChange('title', text)}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kilometraj curent *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 125000"
                  keyboardType="numeric"
                  value={formData.km}
                  onChangeText={(text) => handleInputChange('km', text)}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.statusOption, 
                      formData.status === 'pending' && styles.statusOptionSelected
                    ]}
                    onPress={() => handleInputChange('status', 'pending')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'pending' && styles.statusOptionTextSelected
                    ]}>În așteptare</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.statusOption, 
                      formData.status === 'in-progress' && styles.statusOptionSelected
                    ]}
                    onPress={() => handleInputChange('status', 'in-progress')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'in-progress' && styles.statusOptionTextSelected
                    ]}>În lucru</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.statusOption, 
                      formData.status === 'completed' && styles.statusOptionSelected
                    ]}
                    onPress={() => handleInputChange('status', 'completed')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'completed' && styles.statusOptionTextSelected
                    ]}>Finalizat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.statusOption, 
                      formData.status === 'critical' && styles.statusOptionSelected
                    ]}
                    onPress={() => handleInputChange('status', 'critical')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'critical' && styles.statusOptionTextSelected
                    ]}>Critic</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descriere detaliată a lucrării *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Descrieți detaliat problema identificată și/sau lucrările efectuate..."
                  multiline
                  numberOfLines={5}
                  value={formData.description}
                  onChangeText={(text) => handleInputChange('description', text)}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Piese înlocuite</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Filtru ulei, Ulei motor, etc."
                  value={formData.partsReplaced}
                  onChangeText={(text) => handleInputChange('partsReplaced', text)}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Cost piese (Lei)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 450"
                  keyboardType="numeric"
                  value={formData.partsCost.toString()}
                  onChangeText={(text) => handleInputChange('partsCost', text)}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Următoarea verificare (km)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 135000"
                  keyboardType="numeric"
                  value={formData.nextServiceKm}
                  onChangeText={(text) => handleInputChange('nextServiceKm', text)}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Salvează lucrare</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pentru selectarea vehiculului */}
      <Modal
        visible={showVehiclePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selectează vehicul</Text>
              <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.vehicleOption,
                    formData.vehicle === item._id && styles.selectedVehicleOption
                  ]}
                  onPress={() => {
                    handleInputChange('vehicle', item._id);
                    setShowVehiclePicker(false);
                  }}
                >
                  <Ionicons 
                    name={formData.vehicle === item._id ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={formData.vehicle === item._id ? colors.primary : colors.textSecondary} 
                    style={{ marginRight: 10 }}
                  />
                  <View>
                    <Text style={styles.vehicleOptionText}>
                      {item.plateNumber}
                    </Text>
                    <Text style={styles.vehicleOptionSubtext}>
                      {item.model} - {item.city}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nu există vehicule disponibile</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal pentru finalizarea unei lucrări */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCompleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finalizează lucrarea</Text>
              <TouchableOpacity onPress={closeCompleteModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Piese înlocuite</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Filtru ulei, Ulei motor, etc."
                  value={completeData.partsReplaced}
                  onChangeText={(text) => setCompleteData(prev => ({ ...prev, partsReplaced: text }))}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Cost piese (Lei)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 450"
                  keyboardType="numeric"
                  value={completeData.partsCost.toString()}
                  onChangeText={(text) => setCompleteData(prev => ({ ...prev, partsCost: text }))}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Imagine problemă (opțional)</Text>
                {problemFile ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: problemFile.uri }} 
                      style={styles.imagePreview} 
                    />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setProblemFile(null)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.imagePickerButton}
                    onPress={() => pickImage('problem')}
                  >
                    <Ionicons name="camera" size={24} color={colors.primary} />
                    <Text style={styles.imagePickerText}>Selectează imagine</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Imagine bon/factură (opțional)</Text>
                {receiptFile ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: receiptFile.uri }} 
                      style={styles.imagePreview} 
                    />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setReceiptFile(null)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.imagePickerButton}
                    onPress={() => pickImage('receipt')}
                  >
                    <Ionicons name="camera" size={24} color={colors.primary} />
                   <Text style={styles.imagePickerText}>Selectează imagine</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={closeCompleteModal}
              >
                <Text style={styles.cancelButtonText}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleCompleteSubmit}
              >
                <Text style={styles.submitButtonText}>Salvează finalizarea</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  
  // Header
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  
  // Stats Cards
  statsContainer: {
    paddingVertical: 16,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginLeft: 16,
    marginRight: 4,
    width: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  statsIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  statsFooter: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  // Section
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  
  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '23%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  quickActionText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Maintenance List
  maintenanceList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  maintenanceItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    position: 'relative',
  },
  maintenanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maintenanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  maintenanceDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  maintenanceDescription: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  completeButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  
  // View All Button
  viewAllButton: {
    backgroundColor: colors.inputBackground,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewAllButtonText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  
  // Loading and Empty States
  loadingContainer: {
    backgroundColor: colors.card,
    padding: 20,
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    padding: 20,
    alignItems: 'center',
    borderRadius: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerModalContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: '90%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  
  // Form
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 12,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // Picker Button
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  pickerPlaceholder: {
    color: colors.textSecondary,
  },
  
  // Vehicle Option
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  selectedVehicleOption: {
    backgroundColor: colors.primary + '10',
  },
  vehicleOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  vehicleOptionSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  
  // Status Options
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusOption: {
    width: '48%',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  statusOptionSelected: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  statusOptionText: {
    color: colors.text,
  },
  statusOptionTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  
  // Image Picker
  imagePickerButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  imagePickerText: {
    color: colors.primary,
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  
  // Buttons
  cancelButton: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default MechanicDashboardScreen;