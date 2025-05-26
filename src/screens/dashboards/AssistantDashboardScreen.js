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
  Modal
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axios from '../../utils/axios';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';
import { Picker } from '@react-native-picker/picker';
import { updateUser } from '../../redux/actions/authActions';

// Componenta pentru asignarea vehiculului
const AssignVehicle = () => {
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workDuration, setWorkDuration] = useState(null);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  // Obține vehiculele disponibile când se încarcă componenta
  useEffect(() => {
    if (!user.isWorking) {
      fetchAvailableVehicles();
    } else {
      // Calculează durata turei
      updateWorkDuration();
      // Setează un interval pentru a actualiza durata la fiecare minut
      const interval = setInterval(updateWorkDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [user.isWorking, user.workStartTime]);

  // Obține detaliile vehiculului când utilizatorul are un vehicul asignat
  useEffect(() => {
    // Verifică dacă utilizatorul are un vehicul asignat
    if (user.activeVehicle) {
      // Verifică dacă activeVehicle este un ID sau un obiect
      if (typeof user.activeVehicle === 'string') {
        const fetchVehicleDetails = async () => {
          try {
            const res = await axios.get(`/vehicles/${user.activeVehicle}`);
            if (res.data.success) {
              setVehicleDetails(res.data.data);
            }
          } catch (err) {
            console.error('Eroare la obținerea detaliilor vehiculului:', err);
          }
        };
        
        fetchVehicleDetails();
      } else {
        setVehicleDetails(user.activeVehicle);
      }
    }
  }, [user.activeVehicle]);

  // Funcție pentru a actualiza durata turei
  const updateWorkDuration = () => {
    if (user.workStartTime) {
      const startTime = new Date(user.workStartTime);
      const now = new Date();
      const diffMs = now - startTime;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      setWorkDuration(`${diffHrs}h ${diffMins}m`);
    }
  };

  // Obține vehiculele disponibile din baza de date
  const fetchAvailableVehicles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Facem un GET la endpoint-ul pentru vehicule disponibile
      const res = await axios.get('/tracking/available-vehicles');
      
      if (res.data.success) {
        setAvailableVehicles(res.data.data);
      } else {
        setError('Nu s-au putut obține vehiculele disponibile');
      }
    } catch (err) {
      console.error('Eroare la obținerea vehiculelor disponibile:', err);
      setError(err.response?.data?.message || 'Eroare la obținerea vehiculelor disponibile');
    } finally {
      setLoading(false);
    }
  };

  // Asignează vehiculul selectat asistentului
  const handleStartShift = async () => {
    if (!selectedVehicle) {
      Alert.alert('Eroare', 'Vă rugăm să selectați un vehicul');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.post('/tracking/assign-vehicle', {
        vehicleId: selectedVehicle
      });
      
      if (res.data.success) {
        // Obține detaliile vehiculului
        let vehicleInfo = res.data.data.vehicle;
        
        // Actualizează starea utilizatorului în Redux
        dispatch(updateUser({
          ...user,
          activeVehicle: res.data.data.user.activeVehicle,
          isWorking: res.data.data.user.isWorking,
          workStartTime: res.data.data.user.workStartTime
        }));
        
        // Setează vehiculul asignat în starea locală
        setVehicleDetails(vehicleInfo);
        
        // Resetăm vehiculul selectat
        setSelectedVehicle('');
      } else {
        setError('Nu s-a putut asigna vehiculul');
        Alert.alert('Eroare', 'Nu s-a putut asigna vehiculul');
      }
    } catch (err) {
      console.error('Eroare la asignarea vehiculului:', err);
      setError(err.response?.data?.message || 'Eroare la asignarea vehiculului');
      Alert.alert('Eroare', err.response?.data?.message || 'Eroare la asignarea vehiculului');
    } finally {
      setLoading(false);
    }
  };

  // Eliberează vehiculul asignat
  const handleEndShift = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.post('/tracking/release-vehicle');
      
      if (res.data.success) {
        // Actualizează starea utilizatorului în Redux
        dispatch(updateUser({
          ...user,
          activeVehicle: null,
          isWorking: false,
          workStartTime: null
        }));
        
        // Resetăm durata turei și detaliile vehiculului
        setWorkDuration(null);
        setVehicleDetails(null);
        
        // Reîncărcăm vehiculele disponibile
        fetchAvailableVehicles();
      } else {
        setError('Nu s-a putut finaliza tura');
        Alert.alert('Eroare', 'Nu s-a putut finaliza tura');
      }
    } catch (err) {
      console.error('Eroare la finalizarea turei:', err);
      setError(err.response?.data?.message || 'Eroare la finalizarea turei');
      Alert.alert('Eroare', err.response?.data?.message || 'Eroare la finalizarea turei');
    } finally {
      setLoading(false);
    }
  };

  // Rezolvare pentru picker pe iOS - folosim un Modal pentru a simula dropdown
  const renderVehiclePickerButton = () => {
    // Determinăm textul care va fi afișat pe buton
    let displayText = "-- Selectează vehicul --";
    
    if (selectedVehicle) {
      const vehicle = availableVehicles.find(v => v._id === selectedVehicle);
      if (vehicle) {
        displayText = `${vehicle.name || vehicle.plateNumber} (${vehicle.plateNumber})`;
      }
    }
    
    return (
      <TouchableOpacity 
        style={styles.pickerButton}
        onPress={() => setShowVehiclePicker(true)}
        disabled={loading || availableVehicles.length === 0}
      >
        <Text style={[styles.pickerButtonText, !selectedVehicle && styles.pickerPlaceholder]}>
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  // Modal pentru selectarea vehiculului pe iOS
  const renderVehiclePickerModal = () => {
    return (
      <Modal
        visible={showVehiclePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Selectează vehicul</Text>
              <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={availableVehicles}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.vehicleOption,
                    selectedVehicle === item._id && styles.selectedVehicleOption
                  ]}
                  onPress={() => {
                    setSelectedVehicle(item._id);
                    setShowVehiclePicker(false);
                  }}
                >
                  <Ionicons 
                    name={selectedVehicle === item._id ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={selectedVehicle === item._id ? colors.primary : colors.textSecondary} 
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.vehicleOptionText}>
                    {`${item.name || item.plateNumber} (${item.plateNumber})`}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noVehiclesText}>Nu există vehicule disponibile</Text>
              }
            />
            
            <View style={styles.pickerModalFooter}>
              <TouchableOpacity 
                style={styles.pickerModalCancelButton}
                onPress={() => setShowVehiclePicker(false)}
              >
                <Text style={styles.pickerModalCancelText}>Anulează</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Dacă asistentul nu lucrează momentan, afișăm formularul de asignare vehicul
  if (!user.isWorking) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          <Ionicons name="car" size={20} color={colors.text} /> Începe tura
        </Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.label}>Selectează vehicul</Text>
            
            {Platform.OS === 'ios' ? (
              // Pentru iOS folosim butonul nostru personalizat
              renderVehiclePickerButton()
            ) : (
              // Pentru Android folosim Picker nativ
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedVehicle}
                  onValueChange={(itemValue) => setSelectedVehicle(itemValue)}
                  enabled={!loading && availableVehicles.length > 0}
                  style={styles.picker}
                >
                  <Picker.Item label="-- Selectează vehicul --" value="" />
                  {availableVehicles.map(vehicle => (
                    <Picker.Item 
                      key={vehicle._id} 
                      label={`${vehicle.name || vehicle.plateNumber} (${vehicle.plateNumber})`} 
                      value={vehicle._id} 
                    />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, (!selectedVehicle || loading) && styles.disabledButton]}
          onPress={handleStartShift}
          disabled={loading || !selectedVehicle}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.buttonText}>Începe tura</Text>
            </>
          )}
        </TouchableOpacity>
        
        {availableVehicles.length === 0 && !loading && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>Nu există vehicule disponibile în acest moment.</Text>
          </View>
        )}
        
        {/* Modal pentru picker pe iOS */}
        {renderVehiclePickerModal()}
      </View>
    );
  }
  
  // Dacă asistentul lucrează deja, afișăm informații despre tura curentă
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        <Ionicons name="car" size={20} color={colors.text} /> Tură în desfășurare
      </Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <View style={styles.vehicleInfoContainer}>
        <View style={styles.vehicleInfoRow}>
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleIconContainer}>
              <Ionicons name="car" size={30} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.vehicleName}>
                {vehicleDetails?.name || user.activeVehicle?.name || 'Vehicul'}
              </Text>
              <Text style={styles.vehiclePlate}>
                {vehicleDetails?.plateNumber || user.activeVehicle?.plateNumber || 'N/A'}
              </Text>
            </View>
          </View>
          
          <View style={styles.shiftDurationContainer}>
            <Text style={styles.shiftDurationLabel}>
              <Ionicons name="time" size={14} color={colors.textSecondary} /> Durată tură
            </Text>
            <Text style={styles.shiftDuration}>{workDuration || '0h 0m'}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.button, styles.dangerButton, loading && styles.disabledButton]}
          onPress={handleEndShift}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="stop" size={18} color="#fff" />
              <Text style={styles.buttonText}>Finalizează tura</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Component pentru a afișa un serviciu
const ServiceItem = ({ icon, title, info, cityName, date, amount, status, iconBgColor, onPress }) => (
  <TouchableOpacity 
    style={styles.serviceItem}
    onPress={onPress}
    disabled={status !== 'Urmează'} // Dezactivează apăsarea dacă nu este în așteptare
  >
    <View style={styles.serviceItemHeader}>
      <View style={styles.serviceItemContent}>
        <View style={[styles.serviceItemIcon, { backgroundColor: iconBgColor || colors.primary }]}>
          <Ionicons name={icon} size={18} color="white" />
        </View>
        <View style={styles.serviceItemTextContainer}>
          <Text style={styles.serviceItemTitle}>{title}</Text>
        </View>
      </View>
      
      <View style={styles.serviceItemRight}>
        {amount && (
          <Text style={styles.serviceItemAmount}>{amount}</Text>
        )}
        
        <View style={[
          styles.statusBadge, 
          { 
            backgroundColor: status === 'Finalizat' ? colors.success : 
                            status === 'Anulat' ? colors.error : 
                            colors.primary 
          }
        ]}>
          <Ionicons 
            name={
              status === 'Finalizat' ? 'checkmark-circle' : 
              status === 'Anulat' ? 'close-circle' : 
              'time'
            } 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
    
    <Text style={styles.serviceItemInfo}>{info}</Text>
    
    <View style={styles.serviceItemFooter}>
      <View style={styles.serviceItemMeta}>
        <Ionicons name="location" size={12} color={colors.textSecondary} style={styles.metaIcon} />
        <Text style={styles.serviceItemMetaText}>{cityName}</Text>
        {date && (
          <>
            <Ionicons name="calendar" size={12} color={colors.textSecondary} style={styles.metaIcon} />
            <Text style={styles.serviceItemMetaText}>
              {date.toLocaleDateString('ro-RO', {day: '2-digit', month: '2-digit', year: 'numeric'})}
            </Text>
          </>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// Componenta principală pentru dashboard-ul asistentului
const AssistantDashboardScreen = () => {
  const { user } = useSelector(state => state.auth);
  const navigation = useNavigation();
  const [myServices, setMyServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingService, setUpdatingService] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  // Funcție pentru a reîmprospăta datele
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecentServices();
    setRefreshing(false);
  };

  // Funcție pentru navigare
  const navigateTo = (screen) => {
    navigation.navigate(screen);
  };

  // Funcție pentru a gestiona apăsarea pe un serviciu
  const handleServicePress = (service) => {
    if (service.status === 'Urmează') {
      setSelectedService(service);
      setShowConfirmModal(true);
    }
  };

  // Funcție pentru finalizarea unui serviciu după confirmare
  const handleConfirmComplete = async () => {
    if (!selectedService || !selectedService._id) return;
    
    setShowConfirmModal(false);
    setUpdatingService(selectedService._id);
    
    try {
      let endpoint = '';
      
      // Determinăm endpoint-ul în funcție de tipul serviciului
      if (selectedService.type === 'private') {
        endpoint = `/private-services/${selectedService._id}`;
      } else if (selectedService.type === 'cnas') {
        endpoint = `/cnas-services/${selectedService._id}`;
      } else if (selectedService.type === 'event') {
        endpoint = `/event-services/${selectedService._id}`;
      } else {
        throw new Error('Tip de serviciu necunoscut');
      }
      
      // Actualizăm statusul serviciului
      const res = await axios.put(endpoint, {
        status: 'completed',
        assistant: user._id
      });
      
      if (res.data.success) {
        Alert.alert('Succes', 'Serviciul a fost finalizat cu succes!');
        // Reîmprospătăm serviciile
        fetchRecentServices();
      } else {
        Alert.alert('Eroare', 'Nu s-a putut finaliza serviciul.');
      }
    } catch (err) {
      console.error('Eroare la finalizarea serviciului:', err);
      Alert.alert('Eroare', err.response?.data?.message || 'Nu s-a putut finaliza serviciul.');
    } finally {
      setUpdatingService(null);
      setSelectedService(null);
    }
  };

  // Funcție pentru a anula finalizarea
  const handleCancelComplete = () => {
    setShowConfirmModal(false);
    setSelectedService(null);
  };

  // Obținem cursele recente finalizate și programate
  const fetchRecentServices = async () => {
    setLoading(true);
    try {
      console.log('Începem încărcarea datelor pentru user:', user?.name);
      
      // Obținem serviciile private
      const privateServicesRes = await axios.get(`/private-services?limit=50`)
        .catch(err => {
          console.error('Eroare la obținerea serviciilor private:', err);
          return { data: { success: true, data: [] } };
        });

      // Obținem serviciile CNAS
      const cnasServicesRes = await axios.get(`/cnas-services?limit=50`)
        .catch(err => {
          console.error('Eroare la obținerea serviciilor CNAS:', err);
          return { data: { success: true, data: [] } };
        });
        
      // Obținem evenimentele
      const eventsRes = await axios.get(`/event-services?limit=50`)
        .catch(err => {
          console.error('Eroare la obținerea evenimentelor:', err);
          return { data: { success: true, data: [] } };
        });

      // Combinăm serviciile
      let allServices = [];
      
      // Procesăm serviciile private
      if (privateServicesRes?.data?.success && privateServicesRes?.data?.data && Array.isArray(privateServicesRes.data.data)) {
        const privateServices = privateServicesRes.data.data
          .map(service => {
            // Extragem numele pacientului și telefonul din note
            let patientName = 'Pacient necunoscut';
            let patientPhone = '';
            
            if (service.notes && service.notes.includes('Pacient:')) {
              const patientPart = service.notes.split('Pacient:')[1];
              if (patientPart.includes(',')) {
                patientName = patientPart.split(',')[0].trim();
              }
            }
            
            if (service.notes && service.notes.includes('Telefon:')) {
              const phonePart = service.notes.split('Telefon:')[1];
              if (phonePart.includes(',')) {
                patientPhone = phonePart.split(',')[0].trim();
              }
            }
            
            // Verificăm dacă serviciul poate fi finalizat - acum orice cursa cu status pending poate fi finalizata
            const canComplete = service.status === 'pending';
            
            return {
              _id: service._id,
              type: 'private',
              icon: 'medical',
              iconBgColor: colors.primary,
              title: `Transport privat${service.status === 'completed' ? ' finalizat' : ''}`,
              info: `${service.pickupPoint || service.pickupAddress || ''} → ${service.dropoffPoint || service.dropoffAddress || ''}`,
              amount: service.amount ? `${service.amount} Lei` : '',
              date: new Date(service.completedAt || service.date || new Date()),
              cityName: (service.city && typeof service.city === 'object') ? 
                service.city.name : 
                (typeof service.city === 'string' ? service.city : 'Necunoscut'),
              status: service.status === 'completed' ? 'Finalizat' : 
                      service.status === 'cancelled' ? 'Anulat' : 'Urmează',
              patientName,
              patientPhone,
              canComplete
            };
          });
        
        allServices = [...allServices, ...privateServices];
      }
      
      // Procesăm serviciile CNAS
      if (cnasServicesRes?.data?.success && cnasServicesRes?.data?.data && Array.isArray(cnasServicesRes.data.data)) {
        const cnasServices = cnasServicesRes.data.data
          .map(service => {
            // Verificăm dacă serviciul poate fi finalizat - acum orice cursa cu status pending poate fi finalizata
            const canComplete = service.status === 'pending';
                          
            return {
              _id: service._id,
              type: 'cnas',
              icon: 'medkit',
              iconBgColor: colors.info,
              title: `Serviciu CNAS${service.status === 'completed' ? ' finalizat' : ''}`,
              info: `${service.pickupPoint || service.pickupAddress || ''} → ${service.dropoffPoint || service.dropoffAddress || ''}`,
              amount: '',
              date: new Date(service.completedAt || service.date || new Date()),
              cityName: (service.city && typeof service.city === 'object') ? 
                service.city.name : 
                (typeof service.city === 'string' ? service.city : 'Necunoscut'),
              status: service.status === 'completed' ? 'Finalizat' : 
                      service.status === 'cancelled' ? 'Anulat' : 'Urmează',
              patientName: service.patientName || 'Pacient necunoscut',
              canComplete
            };
          });
        
        allServices = [...allServices, ...cnasServices];
      }
      
      // Procesăm evenimentele
      if (eventsRes?.data?.success && eventsRes?.data?.data && Array.isArray(eventsRes.data.data)) {
        const events = eventsRes.data.data
          .map(event => {
            // Verificăm dacă evenimentul poate fi finalizat - acum orice cursa cu status pending poate fi finalizata
            const canComplete = event.status === 'pending';
                                
            return {
              _id: event._id,
              type: 'event',
              icon: 'calendar',
              iconBgColor: colors.warning,
              title: `Eveniment: ${event.eventName}`,
              info: `Tip ambulanță: ${event.ambulanceType}`,
              amount: '',
              date: new Date(event.date),
              cityName: (event.city && typeof event.city === 'object') ? 
                event.city.name : 
                (typeof event.city === 'string' ? event.city : 'Necunoscut'),
              status: event.status === 'completed' ? 'Finalizat' : 
                      event.status === 'cancelled' ? 'Anulat' : 'Urmează',
              canComplete
            };
          });
        
        allServices = [...allServices, ...events];
      }
      
      // Sortăm serviciile după dată (cele mai recente primele)
      allServices.sort((a, b) => b.date - a.date);
      
      // Limităm la primele 10 servicii
      setMyServices(allServices.slice(0, 10));
    } catch (err) {
      console.error('Eroare generală la obținerea serviciilor:', err);
      
      // Setăm valori implicite pentru a asigura că interfața nu se blochează
      setMyServices([]);
    } finally {
      setLoading(false);
    }
  };

  // Modal de confirmare pentru finalizarea serviciului
  const renderConfirmModal = () => {
    return (
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelComplete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <View style={styles.confirmModalHeader}>
              <Text style={styles.confirmModalTitle}>Confirmare</Text>
            </View>
            
            <View style={styles.confirmModalBody}>
              <Text style={styles.confirmModalText}>
                Ești sigur {user?.name} că vrei să finalizezi cursa?
              </Text>
            </View>
            
            <View style={styles.confirmModalFooter}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelComplete}
              >
                <Text style={styles.cancelButtonText}>Nu</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirmComplete}
              >
                <Text style={styles.confirmButtonText}>Da</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Încărcăm datele la montarea componentei
  useEffect(() => {
    fetchRecentServices();
    
    // Actualizăm datele la fiecare 2 minute
    const interval = setInterval(fetchRecentServices, 120000);
    return () => clearInterval(interval);
  }, [user]);

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
          <Text style={styles.headerTitle}>Bună, {user?.name?.split(' ')[0] || 'Asistent'}!</Text>
          <Text style={styles.headerSubtitle}>Bine ai venit în aplicația Ambu-Life</Text>
        </View>

        {/* Assign Vehicle component */}
        <AssignVehicle />

        {/* Acțiuni Rapide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('PrivateBookings')}
            >
              <Ionicons name="medical" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Transport Privat</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('CNASBookings')}
            ><Ionicons name="document-text" size={24} color={colors.info} />
             <Text style={styles.quickActionText}>Document CNAS</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={styles.quickActionButton} 
             onPress={() => navigateTo('Events')}
           >
             <Ionicons name="calendar" size={24} color={colors.warning} />
             <Text style={styles.quickActionText}>Evenimente</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={styles.quickActionButton} 
             onPress={() => navigateTo('Fuel')}
           >
             <Ionicons name="car" size={24} color={colors.success} />
             <Text style={styles.quickActionText}>Bon Carburant</Text>
           </TouchableOpacity>
         </View>
       </View>

       {/* Recent Services */}
       <View style={styles.section}>
         <Text style={styles.sectionTitle}>Curse recente</Text>
         
         {loading ? (
           <View style={styles.loadingContainer}>
             <ActivityIndicator size="small" color={colors.primary} />
             <Text style={styles.loadingText}>Se încarcă cursele recente...</Text>
           </View>
         ) : myServices.length === 0 ? (
           <View style={styles.emptyContainer}>
             <Text style={styles.emptyText}>Nu există curse recente.</Text>
           </View>
         ) : (
           <View style={styles.cardContainer}>
             <FlatList
               data={myServices}
               keyExtractor={(item) => item._id}
               renderItem={({ item }) => (
                 <View style={styles.serviceItemContainer}>
                   <ServiceItem 
                     icon={item.icon}
                     title={item.title}
                     info={item.info}
                     cityName={item.cityName}
                     date={item.date}
                     amount={item.amount}
                     status={item.status}
                     iconBgColor={item.iconBgColor}
                     onPress={() => handleServicePress(item)}
                   />
                   {updatingService === item._id && (
                     <View style={styles.updatingOverlay}>
                       <ActivityIndicator size="small" color={colors.primary} />
                     </View>
                   )}
                 </View>
               )}
               scrollEnabled={false}
             />
           </View>
         )}
       </View>

       {/* Modal de confirmare pentru finalizarea serviciului */}
       {renderConfirmModal()}
     </ScrollView>
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
 
 // Card Container
 cardContainer: {
   backgroundColor: colors.card,
   borderRadius: 12,
   padding: 12,
   elevation: 2,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 1 },
   shadowOpacity: 0.1,
   shadowRadius: 1,
 },
 
 // Service Item
 serviceItemContainer: {
   marginBottom: 12,
   borderBottomWidth: 1,
   borderBottomColor: colors.divider,
   paddingBottom: 12,
   position: 'relative',
 },
 serviceItem: {
   padding: 4,
 },
 serviceItemHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'flex-start',
   marginBottom: 6,
 },
 serviceItemContent: {
   flexDirection: 'row',
   alignItems: 'center',
   flex: 1,
 },
 serviceItemRight: {
   alignItems: 'flex-end',
 },
 serviceItemIcon: {
   width: 36,
   height: 36,
   borderRadius: 18,
   justifyContent: 'center',
   alignItems: 'center',
   marginRight: 12,
 },
 serviceItemTextContainer: {
   flex: 1,
 },
 serviceItemTitle: {
   fontSize: 15,
   fontWeight: 'bold',
   color: colors.text,
 },
 serviceItemInfo: {
   fontSize: 14,
   color: colors.text,
   marginBottom: 6,
   paddingLeft: 48,
 },
 serviceItemFooter: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   paddingLeft: 48,
 },
 serviceItemMeta: {
   flexDirection: 'row',
   alignItems: 'center',
   flexWrap: 'wrap',
   flex: 1,
 },
 serviceItemMetaText: {
   fontSize: 12,
   color: colors.textSecondary,
   marginRight: 8,
 },
 metaIcon: {
   marginRight: 2,
 },
 serviceItemAmount: {
   fontSize: 14,
   fontWeight: 'bold',
   color: colors.success,
   marginBottom: 6,
 },
 statusBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 8,
   paddingVertical: 3,
   borderRadius: 12,
 },
 statusText: {
   color: '#fff',
   fontSize: 10,
   fontWeight: 'bold',
   marginLeft: 3,
 },
 updatingOverlay: {
   position: 'absolute',
   top: 0,
   left: 0,
   right: 0,
   bottom: 0,
   backgroundColor: 'rgba(255,255,255,0.7)',
   justifyContent: 'center',
   alignItems: 'center',
 },
 
 // Loading
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
 
 // Empty
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
 
 // Card
 card: {
   backgroundColor: colors.card,
   borderRadius: 12,
   padding: 16,
   marginHorizontal: 16,
   marginVertical: 10,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 2,
 },
 cardTitle: {
   fontSize: 18,
   fontWeight: 'bold',
   color: colors.text,
   marginBottom: 16,
 },
 
 // Form
 formRow: {
   marginBottom: 16,
 },
 formColumn: {
   flex: 1,
 },
 label: {
   fontSize: 14,
   color: colors.text,
   marginBottom: 8,
   fontWeight: '500',
 },
 // Container Picker pentru Android
 pickerContainer: {
   backgroundColor: colors.inputBackground,
   borderRadius: 8,
   borderWidth: 1,
   borderColor: colors.divider,
   overflow: 'hidden',
   marginBottom: 16,
 },
 picker: {
   color: colors.text,
   height: 50,
   width: '100%',
 },
 
 // Custom Picker Button pentru iOS
 pickerButton: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   backgroundColor: colors.inputBackground,
   borderRadius: 8,
   borderWidth: 1,
   borderColor: colors.divider,
   padding: 12,
   marginBottom: 16,
 },
 pickerButtonText: {
   fontSize: 16,
   color: colors.text,
   flex: 1,
 },
 pickerPlaceholder: {
   color: colors.textSecondary,
 },
 
 // Modal pentru picker pe iOS
 modalOverlay: {
   flex: 1,
   backgroundColor: 'rgba(0,0,0,0.5)',
   justifyContent: 'center', // Modificat pentru a centra modalul
   alignItems: 'center',     // Adăugat pentru a centra modalul
 },
 pickerModalContainer: {
   backgroundColor: colors.card,
   borderTopLeftRadius: 16,
   borderTopRightRadius: 16,
   paddingBottom: Platform.OS === 'ios' ? 30 : 16,
   width: '100%',           // Pentru a ocupa întreaga lățime pentru acest modal specific
   marginTop: 'auto',       // Pentru a poziționa la partea de jos
 },
 pickerModalHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   padding: 16,
   borderBottomWidth: 1,
   borderBottomColor: colors.divider,
 },
 pickerModalTitle: {
   fontSize: 18,
   fontWeight: 'bold',
   color: colors.text,
 },
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
 noVehiclesText: {
   padding: 16,
   textAlign: 'center',
   color: colors.textSecondary,
   fontStyle: 'italic',
 },
 pickerModalFooter: {
   padding: 16,
   borderTopWidth: 1,
   borderTopColor: colors.divider,
   alignItems: 'center',
 },
 pickerModalCancelButton: {
   paddingVertical: 12,
   paddingHorizontal: 24,
   borderRadius: 8,
   backgroundColor: colors.inputBackground,
 },
 pickerModalCancelText: {
   color: colors.text,
   fontWeight: 'bold',
   fontSize: 16,
 },
 
 // Buttons
 button: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   paddingVertical: 12,
   paddingHorizontal: 16,
   borderRadius: 8,
   marginVertical: 8,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 1 },
   shadowOpacity: 0.2,
   shadowRadius: 1.5,
   elevation: 2,
 },
 primaryButton: {
   backgroundColor: colors.primary,
 },
 dangerButton: {
   backgroundColor: colors.error,
 },
 disabledButton: {
   opacity: 0.6,
 },
 buttonText: {
   color: '#fff',
   fontWeight: 'bold',
   marginLeft: 8,
   fontSize: 16,
 },
 
 // Error and Warning
 errorContainer: {
   backgroundColor: colors.error + '20',
   padding: 12,
   borderRadius: 8,
   marginBottom: 16,
 },
 errorText: {
   color: colors.error,
   fontSize: 14,
 },
 warningContainer: {
   backgroundColor: colors.warning + '20',
   padding: 12,
   borderRadius: 8,
   marginTop: 16,
 },
 warningText: {
   color: colors.warning,
   fontSize: 14,
 },
 
 // Vehicle Info
 vehicleInfoContainer: {
   marginBottom: 8,
 },
 vehicleInfoRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 16,
 },
 vehicleInfo: {
   flexDirection: 'row',
   alignItems: 'center',
 },
 vehicleIconContainer: {
   width: 50,
   height: 50,
   borderRadius: 25,
   backgroundColor: colors.primary + '20',
   justifyContent: 'center',
   alignItems: 'center',
   marginRight: 12,
 },
 vehicleName: {
   fontSize: 16,
   fontWeight: 'bold',
   color: colors.text,
 },
 vehiclePlate: {
   fontSize: 14,
   color: colors.textSecondary,
 },
 shiftDurationContainer: {
   alignItems: 'center',
 },
 shiftDurationLabel: {
   fontSize: 12,
   color: colors.textSecondary,
   marginBottom: 4,
 },
 shiftDuration: {
   fontSize: 16,
   fontWeight: 'bold',
   color: colors.text,
 },
 
 // Modal de confirmare
 confirmModalContainer: {
   backgroundColor: colors.card,
   borderRadius: 12,
   width: '80%',
   padding: 16,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.25,
   shadowRadius: 4,
   elevation: 5,
 },
 confirmModalHeader: {
   borderBottomWidth: 1,
   borderBottomColor: colors.divider,
   paddingBottom: 12,
   marginBottom: 16,
 },
 confirmModalTitle: {
   fontSize: 18,
   fontWeight: 'bold',
   color: colors.text,
   textAlign: 'center',
 },
 confirmModalBody: {
   marginBottom: 16,
 },
 confirmModalText: {
   fontSize: 16,
   color: colors.text,
   textAlign: 'center',
 },
 confirmModalFooter: {
   flexDirection: 'row',
   justifyContent: 'space-between',
 },
 confirmButton: {
   backgroundColor: colors.success,
   flex: 1,
   marginLeft: 8,
 },
 cancelButton: {
   backgroundColor: colors.error,
   flex: 1,
   marginRight: 8,
 },
 confirmButtonText: {
   color: '#fff',
   fontWeight: 'bold',
   textAlign: 'center',
 },
 cancelButtonText: {
   color: '#fff',
   fontWeight: 'bold',
   textAlign: 'center',
 }
});

export default AssistantDashboardScreen;