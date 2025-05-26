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
  Modal,
  FlatList
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axios from '../../utils/axios';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../utils/colors';

const StatCard = ({ icon, value, label, iconBgColor, onPress }) => (
  <TouchableOpacity 
    style={[styles.statCard, { backgroundColor: colors.card }]}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.statCardContent}>
      <View style={[styles.statCardIcon, { backgroundColor: iconBgColor || colors.primary }]}>
        <Ionicons name={icon} size={24} color="white" />
      </View>
      <View style={styles.statCardTextContainer}>
        <Text style={styles.statCardValue}>{value}</Text>
        <Text style={styles.statCardLabel}>{label}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const ServiceItem = ({ icon, title, info, amount, iconBgColor }) => (
  <View style={styles.serviceItem}>
    <View style={styles.serviceItemContent}>
      <View style={[styles.serviceItemIcon, { backgroundColor: iconBgColor || colors.primary }]}>
        <Ionicons name={icon} size={18} color="white" />
      </View>
      <View style={styles.serviceItemTextContainer}>
        <Text style={styles.serviceItemTitle}>{title}</Text>
        <Text style={styles.serviceItemInfo}>{info}</Text>
      </View>
    </View>
    {amount && (
      <Text style={styles.serviceItemAmount}>{amount}</Text>
    )}
  </View>
);

const AdminDashboardScreen = () => {
  const { user } = useSelector(state => state.auth);
  const navigation = useNavigation();
  const [activeUsers, setActiveUsers] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [fuelData, setFuelData] = useState([]);
  const [recentServices, setRecentServices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);
  
  const [stats, setStats] = useState({
    privateServices: { count: 0, increase: 0 },
    privateIncome: { amount: 0, increase: 0 },
    activeAssistants: { count: 0, cities: {} }
  });
  
  const [loading, setLoading] = useState({
    cashFlow: true,
    fuel: true,
    services: true,
    stats: true
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    Promise.all([
      fetchStatsData(),
      fetchServicesData(),
      fetchCashFlowData(),
      fetchFuelData(),
      fetchActiveUsers()
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const fetchActiveUsers = async () => {
    try {
      const usersRes = await axios.get('/tracking/active-users');
      if (usersRes.data.success) {
        const users = usersRes.data.data || [];
        setActiveUsers(users);
        
        // Update active assistants count here
        let activeAssistantCount = 0;
        let assistantCities = {};
        
        if (users && users.length > 0) {
          // A user is considered active if they have a workStartTime
          activeAssistantCount = users.filter(user => user.workStartTime).length;
          
          users.filter(user => user.workStartTime).forEach(user => {
            const cityName = user.city && typeof user.city === 'object' ? user.city.name : 'Necunoscut';
            assistantCities[cityName] = (assistantCities[cityName] || 0) + 1;
          });
        }
        
        setStats(prev => ({
          ...prev,
          activeAssistants: {
            count: activeAssistantCount || 0,
            cities: Object.keys(assistantCities).length > 0 ? assistantCities : { 'Suceava': 0, 'Botoșani': 0 }
          }
        }));
      }
    } catch (err) {
      console.error('Eroare la obținerea utilizatorilor activi:', err);
    }
  };

  const fetchStatsData = async () => {
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const privateServicesRes = await axios.get('/private-services?sort=-date&limit=1000')
        .catch(err => {
          console.warn('Eroare la obținerea serviciilor private:', err);
          return { data: { success: true, data: [] } };
        });
        
      let currentMonthCount = 0;
      let previousMonthCount = 0;
      let currentMonthTotal = 0;
      let previousMonthTotal = 0;
      
      if (privateServicesRes?.data?.success && privateServicesRes?.data?.data) {
        const services = privateServicesRes.data.data;
        
        services.forEach(service => {
          const serviceDate = new Date(service.date);
          const serviceMonth = serviceDate.getMonth();
          const serviceYear = serviceDate.getFullYear();
          
          if (serviceMonth === currentMonth && serviceYear === currentYear) {
            currentMonthCount++;
            currentMonthTotal += Number(service.amount) || 0;
          }
          else if (serviceMonth === previousMonth && serviceYear === previousMonthYear) {
            previousMonthCount++;
            previousMonthTotal += Number(service.amount) || 0;
          }
        });
      }
      
      const countIncrease = previousMonthCount > 0 
        ? Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 100) 
        : 0;
        
      const incomeIncrease = previousMonthTotal > 0 
        ? Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100) 
        : 0;
      
      setStats(prev => ({
        ...prev,
        privateServices: {
          count: currentMonthCount || 0,
          increase: countIncrease
        },
        privateIncome: {
          amount: currentMonthTotal || 0,
          increase: incomeIncrease
        }
      }));
    } catch (err) {
      console.error('Eroare generală la obținerea statisticilor:', err);
      setStats(prev => ({
        ...prev,
        privateServices: { count: 0, increase: 0 },
        privateIncome: { amount: 0, increase: 0 }
      }));
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  };

  const fetchServicesData = async () => {
    setLoading(prev => ({ ...prev, services: true }));
    
    try {
      const [privateServicesRes, cnasServicesRes, eventServicesRes] = await Promise.all([
        axios.get('/private-services?limit=2&sort=-date'),
        axios.get('/cnas-services?limit=2&sort=-date'),
        axios.get('/event-services?limit=2&sort=-date')
      ]);
      
      let allServices = [];
      
      if (privateServicesRes.data.success && privateServicesRes.data.data) {
        const privateServices = privateServicesRes.data.data.map(service => ({
          _id: service._id,
          type: 'private',
          icon: 'medical',
          iconBgColor: colors.primary,
          title: 'Transport privat',
          info: `${service.pickupPoint} → ${service.dropoffPoint}`,
          amount: `${service.amount} Lei`,
          date: new Date(service.date),
          cityName: service.city && typeof service.city === 'object' ? service.city.name : 'Necunoscut'
        }));
        
        allServices = [...allServices, ...privateServices];
      }
      
      if (cnasServicesRes.data.success && cnasServicesRes.data.data) {
        const cnasServices = cnasServicesRes.data.data.map(service => ({
          _id: service._id,
          type: 'cnas',
          icon: 'medkit',
          iconBgColor: colors.info,
          title: 'Serviciu CNAS',
          info: `${service.pickupPoint} → ${service.dropoffPoint}`,
          amount: '',
          date: new Date(service.date),
          cityName: service.city && typeof service.city === 'object' ? service.city.name : 'Necunoscut'
        }));
        
        allServices = [...allServices, ...cnasServices];
      }
      
      if (eventServicesRes.data.success && eventServicesRes.data.data) {
        const events = eventServicesRes.data.data.map(event => ({
          _id: event._id,
          type: 'event',
          icon: 'calendar',
          iconBgColor: colors.success,
          title: `Eveniment: ${event.eventName}`,
          info: event.notes || '',
          amount: '',
          date: new Date(event.date),
          cityName: event.city && typeof event.city === 'object' ? event.city.name : 'Necunoscut'
        }));
        
        allServices = [...allServices, ...events];
      }
      
      allServices.sort((a, b) => b.date - a.date);
      
      setRecentServices(allServices.slice(0, 4));
    } catch (err) {
      console.error('Eroare la obținerea serviciilor recente:', err);
    } finally {
      setLoading(prev => ({ ...prev, services: false }));
    }
  };

  const fetchCashFlowData = async () => {
    setLoading(prev => ({ ...prev, cashFlow: true }));
    try {
      const response = await axios.get('/cash-flow');
      
      if (response.data && response.data.data) {
        const formattedData = response.data.data
          .slice(0, 4)
          .map(record => ({
            id: record._id,
            icon: record.type === 'income' ? 'add-circle' : 'remove-circle',
            title: record.description,
            info: record.city?.name ? `${record.info || ''}, ${record.city.name}` : record.info || '',
            amount: record.type === 'income' ? `+${record.amount} Lei` : `-${record.amount} Lei`,
            iconBgColor: record.type === 'income' ? colors.success : colors.accent
          }));
        
        setCashFlowData(formattedData);
      }
    } catch (err) {
      console.error('Eroare la obținerea datelor Cash Flow:', err);
    } finally {
      setLoading(prev => ({ ...prev, cashFlow: false }));
    }
  };

  const fetchFuelData = async () => {
    setLoading(prev => ({ ...prev, fuel: true }));
    try {
      const response = await axios.get('/fuel');
      
      if (response.data && response.data.data) {
        const formattedData = response.data.data
          .filter(record => record.type === 'fuelConsumption')
          .slice(0, 4)
          .map(record => ({
            id: record._id,
            icon: 'car',
            title: record.vehicle?.plateNumber || 'N/A',
            info: `${record.gasStation}, ${record.info || (Math.round(record.amount / 7))} litri`,
            amount: `-${record.amount} Lei`,
            iconBgColor: colors.primary
          }));
        
        setFuelData(formattedData);
      }
    } catch (err) {
      console.error('Eroare la obținerea datelor Fuel:', err);
    } finally {
      setLoading(prev => ({ ...prev, fuel: false }));
    }
  };

  const formatActiveAssistantsFooter = () => {
    const { cities } = stats.activeAssistants;
    const cityEntries = Object.entries(cities);
    
    if (cityEntries.length === 0) {
      return "0 în Suceava, 0 în Botoșani";
    }
    
    return cityEntries
      .map(([city, count]) => `${count} în ${city}`)
      .join(', ');
  };

  const renderRecentServicesItems = () => {
    if (loading.services) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Se încarcă serviciile recente...</Text>
        </View>
      );
    }
    
    if (recentServices.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nu există servicii recente.</Text>
        </View>
      );
    }
    
    return recentServices.map(service => (
      <View style={styles.serviceItemContainer} key={service._id}>
        <ServiceItem 
          icon={service.icon}
          title={service.title}
          info={`${service.info} (${service.cityName})`}
          amount={service.amount}
          iconBgColor={service.iconBgColor}
        />
      </View>
    ));
  };

  const navigateTo = (screen) => {
    navigation.navigate(screen);
  };

  const renderActiveUsersModal = () => {
    return (
      <Modal
        visible={showActiveUsersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActiveUsersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asistenți Activi</Text>
              <TouchableOpacity onPress={() => setShowActiveUsersModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {activeUsers.filter(user => user.workStartTime).length > 0 ? (
              <FlatList
                data={activeUsers.filter(user => user.workStartTime)}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.userItem}>
                    <View style={styles.userItemContent}>
                      <View style={[styles.userItemIcon, { backgroundColor: colors.success }]}>
                        <Ionicons name="person" size={18} color="white" />
                      </View>
                      <View style={styles.userItemTextContainer}>
                        <Text style={styles.userItemName}>{item.name}</Text>
                        <Text style={styles.userItemInfo}>
                          {item.role === 'admin' ? 'Administrator' : 
                           item.role === 'mechanic' ? 'Mecanic' : 'Asistent Medical'}
                        </Text>
                        <Text style={styles.userItemInfo}>
                          {item.city && typeof item.city === 'object' ? item.city.name : 'Oraș necunoscut'} - Activ din {new Date(item.workStartTime).toLocaleTimeString()}
                        </Text>
                        {item.activeVehicle && (
                          <Text style={styles.userItemInfo}>
                            Vehicul: {item.activeVehicle.plateNumber || 'Necunoscut'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.usersList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Nu există asistenți activi în acest moment.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
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
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Bine ai venit în panoul de administrare Ambu-Life</Text>
        </View>

        {/* Stats cards */}
        <View style={styles.statsContainer}>
          <StatCard 
            icon="medical"
            value={loading.stats ? "..." : stats.privateServices.count.toString()}
            label="Total curse private"
            iconBgColor={colors.primary}
          />
          <StatCard 
            icon="cash"
            value={loading.stats ? "..." : `${stats.privateIncome.amount.toLocaleString()} Lei`}
            label="Total încasat"
            iconBgColor={colors.secondary}
          />
          <StatCard 
            icon="people"
            value={loading.stats ? "..." : stats.activeAssistants.count.toString()}
            label="Asistenți activi"
            iconBgColor={colors.success}
            onPress={() => setShowActiveUsersModal(true)}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('PrivateBookings')}
            >
              <Ionicons name="medical" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Servicii Private</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('CNASBookings')}
            >
              <Ionicons name="medkit" size={24} color={colors.info} />
              <Text style={styles.quickActionText}>CNAS</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('Tracking')}
            >
              <Ionicons name="location" size={24} color={colors.warning} />
              <Text style={styles.quickActionText}>Tracking</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('CashFlow')}
            >
              <Ionicons name="cash" size={24} color={colors.success} />
              <Text style={styles.quickActionText}>Cash Flow</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('Events')}
            >
              <Ionicons name="calendar" size={24} color={colors.accent} />
              <Text style={styles.quickActionText}>Evenimente</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionButton} 
              onPress={() => navigateTo('Fuel')}
            >
              <Ionicons name="car" size={24} color={colors.secondary} />
              <Text style={styles.quickActionText}>Carburant</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicii recente</Text>
          <View style={styles.cardContainer}>
            {renderRecentServicesItems()}
          </View>
        </View>

        {/* Recent Cash Flow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cash Flow Recent</Text>
          <View style={styles.cardContainer}>
            {loading.cashFlow ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Se încarcă datele...</Text>
              </View>
            ) : cashFlowData.length > 0 ? (
              cashFlowData.map(item => (
                <View style={styles.serviceItemContainer} key={item.id}>
                  <ServiceItem 
                    icon={item.icon}
                    title={item.title}
                    info={item.info}
                    amount={item.amount}
                    iconBgColor={item.iconBgColor}
                  />
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nu există date de cash flow.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Fuel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alimentări Recente</Text>
          <View style={styles.cardContainer}>
            {loading.fuel ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Se încarcă datele...</Text>
              </View>
            ) : fuelData.length > 0 ? (
              fuelData.map(item => (
                <View style={styles.serviceItemContainer} key={item.id}>
                  <ServiceItem 
                    icon={item.icon}
                    title={item.title}
                    info={item.info}
                    amount={item.amount}
                    iconBgColor={item.iconBgColor}
                  />
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nu există date de alimentări.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      
      {/* Modal pentru asistenții activi */}
      {renderActiveUsersModal()}
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
  statsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '31%',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  statCardContent: {
    alignItems: 'center',
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardTextContainer: {
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  statCardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
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
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  quickActionButton: {
    width: '30%',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    margin: 5,
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
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  serviceItemContainer: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 8,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  serviceItemInfo: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  serviceItemAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  usersList: {
    padding: 16,
  },
  userItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 12,
  },
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userItemTextContainer: {
    flex: 1,
  },
  userItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  userItemInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  }
});

export default AdminDashboardScreen;