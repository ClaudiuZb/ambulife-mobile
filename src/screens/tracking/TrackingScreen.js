// src/screens/tracking/TrackingScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Modal,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  useColorScheme
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../utils/axios';
import { useSelector } from 'react-redux';
import { colors as baseColors } from '../../utils/colors';

const TrackingScreen = ({ navigation }) => {
  const { user } = useSelector(state => state.auth);
  const isAdmin = user && user.role === 'admin';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Extend base colors with dark mode support
  const colors = {
    ...baseColors,
    // Override specific colors for dark mode
    background: isDark ? '#000000' : baseColors.background,
    card: isDark ? '#1c1c1e' : baseColors.card,
    text: isDark ? '#ffffff' : baseColors.text,
    textSecondary: isDark ? '#8e8e93' : baseColors.textSecondary,
    border: isDark ? '#38383a' : baseColors.border,
    inputBackground: isDark ? '#2c2c2e' : baseColors.inputBackground,
    modalBackground: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
  };
  
  const [trackGpsVehicles, setTrackGpsVehicles] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [showListView, setShowListView] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  
  const webViewRef = useRef(null);
  const requestPendingRef = useRef(false);

  const fetchTrackGpsData = async (force = false) => {
    if (requestPendingRef.current && !force) {
      console.log('O cerere este deja în curs. Se ignoră noua cerere.');
      return;
    }
    
    setLoading(!force); // Don't show loading on refresh
    requestPendingRef.current = true;
    
    try {
      console.log('URL: /tracking/vehicles');
      const res = await axios.get('/tracking/vehicles');
      console.log('Data:', JSON.stringify(res.data, null, 2));
      
      if (res.data.success) {
        const vehicles = res.data.data || [];
        console.log('Received vehicles from API:', vehicles.length);
        
        const validVehicles = vehicles.map(vehicle => ({
          ...vehicle,
          Latitude: parseFloat(vehicle.Latitude),
          Longitude: parseFloat(vehicle.Longitude)
        })).filter(v => 
          !isNaN(v.Latitude) && 
          !isNaN(v.Longitude) && 
          v.Latitude >= -90 && v.Latitude <= 90 && 
          v.Longitude >= -180 && v.Longitude <= 180
        );
        
        console.log(`API returned ${vehicles.length} vehicles, ${validVehicles.length} have valid coordinates`);
        
        setTrackGpsVehicles(vehicles);
        setLastUpdated(new Date());
        setError(null);
        setFromCache(res.data.fromCache || false);
        setCacheAge(res.data.cacheAge || 0);
        
        // Send vehicles to WebView with delay to ensure it's ready
        if (webViewRef.current && webViewLoaded) {
          console.log('Sending vehicles to WebView');
          setTimeout(() => {
            try {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'UPDATE_VEHICLES',
                vehicles: validVehicles
              }));
            } catch (err) {
              console.error('Error sending message to WebView:', err);
            }
          }, 500);
        } else {
          console.log('WebView reference not available or not loaded');
        }
      } else {
        setError('Nu s-au putut obține vehiculele TrackGPS');
      }
    } catch (err) {
      console.error('Eroare la obținerea vehiculelor TrackGPS:', err);
      setError(err.response?.data?.message || 'Eroare la obținerea vehiculelor TrackGPS');
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestPendingRef.current = false;
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const res = await axios.get('/tracking/active-users');
      
      if (res.data.success) {
        const users = res.data.data || [];
        setActiveUsers(users);
        
        if (webViewRef.current && webViewLoaded) {
          setTimeout(() => {
            try {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'UPDATE_ACTIVE_USERS',
                users: users
              }));
            } catch (err) {
              console.error('Error sending active users to WebView:', err);
            }
          }, 100);
        }
      }
    } catch (err) {
      console.error('Eroare la obținerea utilizatorilor activi:', err);
    }
  };
  
  useEffect(() => {
    fetchTrackGpsData();
    fetchActiveUsers();
    
    const intervalId = setInterval(() => {
      fetchTrackGpsData();
      fetchActiveUsers();
    }, 60000); // Update every minute
    
    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
    if (webViewLoaded && webViewRef.current) {
      console.log('WebView loaded, sending initial data');
      
      if (trackGpsVehicles.length > 0) {
        const validVehicles = trackGpsVehicles
          .map(v => ({
            ...v,
            Latitude: parseFloat(v.Latitude),
            Longitude: parseFloat(v.Longitude)
          }))
          .filter(v => 
            !isNaN(v.Latitude) && 
            !isNaN(v.Longitude) && 
            v.Latitude >= -90 && v.Latitude <= 90 && 
            v.Longitude >= -180 && v.Longitude <= 180
          );
          
        setTimeout(() => {
          try {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'UPDATE_VEHICLES',
              vehicles: validVehicles
            }));
          } catch (err) {
            console.error('Error sending vehicles to WebView:', err);
          }
        }, 1000);
      }
      
      if (activeUsers.length > 0) {
        setTimeout(() => {
          try {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'UPDATE_ACTIVE_USERS',
              users: activeUsers
            }));
          } catch (err) {
            console.error('Error sending active users to WebView:', err);
          }
        }, 1500);
      }
    }
  }, [webViewLoaded, trackGpsVehicles, activeUsers]);
  
  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchTrackGpsData(true), fetchActiveUsers()])
      .finally(() => setRefreshing(false));
  };
  
  const formatTimeAgo = (date) => {
    if (!date) return '';
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `acum ${seconds} secunde`;
    if (seconds < 3600) return `acum ${Math.floor(seconds / 60)} minute`;
    if (seconds < 86400) return `acum ${Math.floor(seconds / 3600)} ore`;
    return `acum ${Math.floor(seconds / 86400)} zile`;
  };
  
  const getWorkDuration = (startTime) => {
    if (!startTime) return 'Necunoscut';
    
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHrs}h ${diffMins}m`;
  };
  
  const filteredVehicles = trackGpsVehicles.filter(vehicle => {
    return searchTerm === '' ||
      (vehicle.VehicleName && vehicle.VehicleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vehicle.VehicleRegistrationNumber && vehicle.VehicleRegistrationNumber.toLowerCase().includes(searchTerm.toLowerCase()));
  });
  
const findAssignedUser = (vehicle) => {
  // Verificăm dacă vehiculul este valid
  if (!vehicle || typeof vehicle !== 'object') return null;
  
  return activeUsers.find(user => 
    user.activeVehicle && (
      (typeof user.activeVehicle === 'string' && user.activeVehicle === vehicle.VehicleId) ||
      (typeof user.activeVehicle === 'string' && user.activeVehicle === vehicle.VehicleId.toString()) ||
      (typeof user.activeVehicle === 'object' && user.activeVehicle._id === vehicle.VehicleId) ||
      (typeof user.activeVehicle === 'object' && user.activeVehicle._id === vehicle.VehicleId.toString()) ||
      (typeof user.activeVehicle === 'object' && user.activeVehicle.imei === vehicle.VehicleId.toString())
    )
  );
};
  
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'LOG') {
        console.log('WebView log:', data.message);
      } else if (data.type === 'ERROR') {
        console.error('WebView error:', data.message);
      } else if (data.type === 'VEHICLE_SELECTED') {
        const vehicle = trackGpsVehicles.find(v => v.VehicleId === data.vehicleId);
        if (vehicle) {
          setSelectedVehicle(vehicle);
          setShowVehicleDetails(true);
        }
      } else if (data.type === 'MAP_READY') {
        console.log('Map is ready in WebView');
        setWebViewLoaded(true);
        
        // Send data when map is ready
        if (trackGpsVehicles.length > 0 && webViewRef.current) {
          const validVehicles = trackGpsVehicles
            .map(v => ({
              ...v,
              Latitude: parseFloat(v.Latitude),
              Longitude: parseFloat(v.Longitude)
            }))
            .filter(v => 
              !isNaN(v.Latitude) && 
              !isNaN(v.Longitude) && 
              v.Latitude >= -90 && v.Latitude <= 90 && 
              v.Longitude >= -180 && v.Longitude <= 180
            );
            
          console.log('Sending vehicles to ready map:', validVehicles.length);
          setTimeout(() => {
            try {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'UPDATE_VEHICLES',
                vehicles: validVehicles
              }));
            } catch (err) {
              console.error('Error sending vehicles to ready map:', err);
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
    }
  };
  
  const generateMapHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>Tracking Map</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background-color: ${isDark ? '#000000' : '#ffffff'};
          }
          html, body, #map { height: 100%; width: 100%; }
          
          .leaflet-popup-content {
            width: 220px;
            padding: 8px;
            background-color: ${isDark ? '#1c1c1e' : '#ffffff'};
            color: ${isDark ? '#ffffff' : '#000000'};
          }
          
          .leaflet-popup-content-wrapper {
            background-color: ${isDark ? '#1c1c1e' : '#ffffff'};
          }
          
          .leaflet-popup-tip {
            background-color: ${isDark ? '#1c1c1e' : '#ffffff'};
          }
          
          .popup-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
            color: ${isDark ? '#ffffff' : '#000000'};
          }
          
          .popup-assistant {
            background-color: ${isDark ? 'rgba(40, 167, 69, 0.3)' : 'rgba(40, 167, 69, 0.1)'};
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 8px;
          }
          
          .popup-detail {
            margin-bottom: 4px;
            color: ${isDark ? '#ffffff' : '#000000'};
          }
          
          .ambulance-icon {
            width: 30px;
            height: 30px;
            border-radius: 15px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: bold;
            color: white;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
          }
          
          .ambulance-icon-blue {
            background-color: #007BFF;
          }
          
          .ambulance-icon-green {
            background-color: #28a745;
          }
          
          .vehicle-label {
            background-color: ${isDark ? '#2c2c2e' : 'white'};
            color: ${isDark ? '#ffffff' : '#000000'};
            border: 1px solid ${isDark ? '#38383a' : '#ccc'};
            border-radius: 3px;
            padding: 2px 4px;
            font-size: 10px;
            white-space: nowrap;
            text-align: center;
            margin-top: 2px;
          }
          
          /* Dark mode for Leaflet controls */
          ${isDark ? `
          .leaflet-control-layers,
          .leaflet-control-zoom {
            background-color: #1c1c1e;
            border-color: #38383a;
          }
          
          .leaflet-control-zoom a {
            background-color: #1c1c1e;
            color: #ffffff;
            border-color: #38383a;
          }
          
          .leaflet-control-zoom a:hover {
            background-color: #2c2c2e;
            color: #ffffff;
          }
          
          .leaflet-control-attribution {
            background-color: rgba(28, 28, 30, 0.8);
            color: #ffffff;
          }
          
          .leaflet-control-attribution a {
            color: #007BFF;
          }
          ` : ''}
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Logging function
          function sendLog(message) {
            try {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LOG',
                  message: message
                }));
              }
            } catch (err) {
              console.error('Error sending log:', err);
            }
          }
          
          // Initialize map
          const map = L.map('map').setView([47.6635, 26.2732], 10);
          
          sendLog('Map initialized');
          
          // Add OpenStreetMap tiles with dark mode support
          const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            ${isDark ? `
            className: 'dark-tiles'
            ` : ''}
          }).addTo(map);
          
          ${isDark ? `
          // Apply dark mode filter to tiles
          const style = document.createElement('style');
          style.textContent = \`
            .leaflet-tile {
              filter: invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.2);
            }
          \`;
          document.head.appendChild(style);
          ` : ''}
          
          // Store markers and active users
          let markers = {};
          let activeUsers = [];
          
          // Calculate work duration
          function getWorkDuration(startTime) {
            if (!startTime) return 'Necunoscut';
            
            const start = new Date(startTime);
            const now = new Date();
            const diffMs = now - start;
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            return diffHrs + 'h ' + diffMins + 'm';
          }
          
          // Find assigned user for a vehicle
          function findAssignedUser(vehicleId) {
            return activeUsers.find(user => 
              user.activeVehicle && (
                (typeof user.activeVehicle === 'string' && user.activeVehicle === vehicleId) ||
                (typeof user.activeVehicle === 'string' && user.activeVehicle === vehicleId.toString()) ||
                (typeof user.activeVehicle === 'object' && user.activeVehicle._id === vehicleId) ||
                (typeof user.activeVehicle === 'object' && user.activeVehicle._id === vehicleId.toString()) ||
                (typeof user.activeVehicle === 'object' && user.activeVehicle.imei === vehicleId.toString())
              )
            );
          }
          
          // Create popup content
          function createPopupContent(vehicle) {
            const assignedUser = findAssignedUser(vehicle.VehicleId);
            
            let content = '<div class="popup-title">' + (vehicle.VehicleRegistrationNumber || vehicle.VehicleName) + '</div>';
            
            if (assignedUser) {
              content += '<div class="popup-assistant">' +
                '<div class="popup-assistant-name">Asistent medical: ' + assignedUser.name + '</div>' +
                '<div style="color: ${isDark ? '#8e8e93' : '#6c757d'}; font-size: 12px; margin-top: 4px;">' +
                'Durată tură: ' + getWorkDuration(assignedUser.workStartTime) +
                '</div></div>';
            }
            
            content += '<div class="popup-detail">' +
              '<strong>Viteză:</strong> ' + (vehicle.Speed || 0) + ' km/h' +
              '</div>' +
              '<div class="popup-detail">' +
              '<strong>Adresă:</strong> ' + (vehicle.Address || 'Necunoscută') +
              '</div>' +
              '<div class="popup-detail" style="color: ${isDark ? '#8e8e93' : '#6c757d'}; font-size: 12px;">' +
              '<strong>Ultima actualizare:</strong> ' + new Date(vehicle.GpsDate).toLocaleString() +
              '</div>';
            
            return content;
          }
          
          // Update vehicles on map
          function updateVehicles(vehicles) {
            sendLog('Updating vehicles: ' + vehicles.length);
            
            if (!vehicles || vehicles.length === 0) {
              sendLog('No vehicles data received');
              return;
            }
            
            // Remove existing markers
            Object.values(markers).forEach(marker => {
              try {
                map.removeLayer(marker);
              } catch (err) {
                sendLog('Error removing marker: ' + err.message);
              }
            });
            markers = {};
            
            let validVehicles = 0;
            let invalidVehicles = 0;
            
            // Add new markers
            vehicles.forEach(vehicle => {
              try {
                sendLog('Processing vehicle: ' + vehicle.VehicleRegistrationNumber);
                
                if (vehicle.Latitude && vehicle.Longitude && 
                    !isNaN(parseFloat(vehicle.Latitude)) && 
                    !isNaN(parseFloat(vehicle.Longitude))) {
                  
                  const lat = parseFloat(vehicle.Latitude);
                  const lng = parseFloat(vehicle.Longitude);
                  
                  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    validVehicles++;
                    
                    const assignedUser = findAssignedUser(vehicle.VehicleId);
                    const isAssigned = !!assignedUser;
                    
                    // Create icon
                    const icon = L.divIcon({
                      html: '<div class="ambulance-icon ' + (isAssigned ? 'ambulance-icon-green' : 'ambulance-icon-blue') + '">A</div>' +
                            '<div class="vehicle-label">' + vehicle.VehicleRegistrationNumber + '</div>',
                      className: '',
                      iconSize: [30, 50],
                      iconAnchor: [15, 25]
                    });
                    
                    // Create marker
                    const marker = L.marker([lat, lng], { 
                      icon: icon,
                      title: vehicle.VehicleRegistrationNumber
                    }).addTo(map);
                    
                    // Add popup
                    marker.bindPopup(createPopupContent(vehicle));
                    
                    // Click event
                    marker.on('click', function() {
                      sendLog('Marker clicked: ' + vehicle.VehicleId);
                      try {
                        if (window.ReactNativeWebView) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'VEHICLE_SELECTED',
                            vehicleId: vehicle.VehicleId
                          }));
                        }
                      } catch (err) {
                        sendLog('Error sending vehicle selected message: ' + err.message);
                      }
                    });
                    
                    // Store marker
                    markers[vehicle.VehicleId] = marker;
                  } else {
                    invalidVehicles++;
                    sendLog('Invalid coordinate ranges: ' + lat + ',' + lng);
                  }
                } else {
                  invalidVehicles++;
                  sendLog('Invalid coordinates for vehicle: ' + vehicle.VehicleId);
                }
              } catch (err) {
                sendLog('Error processing vehicle: ' + err.message);
              }
            });
            
            sendLog('Processed ' + vehicles.length + ' vehicles: ' + validVehicles + ' valid, ' + invalidVehicles + ' invalid');
            
            // Fit map to markers if any exist
            if (Object.keys(markers).length > 0) {
              try {
                const points = [];
                Object.values(markers).forEach(marker => {
                  const latlng = marker.getLatLng();
                  points.push([latlng.lat, latlng.lng]);
                });
                
                if (points.length > 0) {
                  sendLog('Fitting bounds to points: ' + points.length);
                  const bounds = L.latLngBounds(points);
                  map.fitBounds(bounds, { padding: [20, 20] });
                }
              } catch (e) {
                sendLog('Error fitting bounds: ' + e.message);
              }
            } else {
              sendLog('No valid markers to show on map');
            }
          }
          
          // Update active users
          function updateActiveUsers(users) {
            sendLog('Updating active users: ' + users.length);
            activeUsers = users;
            
            // Update icons and popups
            Object.entries(markers).forEach(([vehicleId, marker]) => {
              try {
                const assignedUser = findAssignedUser(parseInt(vehicleId));
                const isAssigned = !!assignedUser;
                
                // Recreate icon with correct color
                const icon = L.divIcon({
                  html: '<div class="ambulance-icon ' + (isAssigned ? 'ambulance-icon-green' : 'ambulance-icon-blue') + '">A</div>' +
                        '<div class="vehicle-label">' + marker.options.title + '</div>',
                  className: '',
                  iconSize: [30, 50],
                  iconAnchor: [15, 25]
                });
                
                // Set new icon
                marker.setIcon(icon);
                
                // Update popup
                const vehicle = { 
                  VehicleId: parseInt(vehicleId),
                  VehicleRegistrationNumber: marker.options.title,
                  Speed: 0,
                  Address: 'Actualizare...',
                  GpsDate: new Date().toISOString()
                };
                marker.setPopupContent(createPopupContent(vehicle));
              } catch (err) {
                sendLog('Error updating marker: ' + err.message);
              }
            });
          }
          
          // Process messages from React Native
          function processMessage(event) {
            try {
              sendLog('WebView received message');
              const data = JSON.parse(event.data);
              sendLog('Parsed message type: ' + data.type);
              
              if (data.type === 'UPDATE_VEHICLES') {
                updateVehicles(data.vehicles);
              } else if (data.type === 'UPDATE_ACTIVE_USERS') {
                updateActiveUsers(data.users);
              } else if (data.type === 'CENTER_ON_VEHICLE') {
                const marker = markers[data.vehicleId];
                if (marker) {
                  map.setView(marker.getLatLng(), 15);
                  marker.openPopup();
                }
              }
            } catch (err) {
              sendLog('Error processing message: ' + err.message);
            }
          }
          
          // Message handlers
          window.addEventListener('message', function(event) {
            processMessage(event);
          });
          
          document.addEventListener('message', function(event) {
            processMessage(event);
          });
          
          // Notify React Native that map is ready
          setTimeout(function() {
            sendLog('Map is ready, sending MAP_READY event');
            try {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'MAP_READY'}));
              }
            } catch (err) {
              sendLog('Error sending MAP_READY: ' + err.message);
            }
          }, 1000);
        </script>
      </body>
      </html>
    `;
  };
  
  const renderVehicleItem = ({ item }) => {
    const assignedUser = findAssignedUser(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.vehicleItem,
          { backgroundColor: colors.card, borderLeftColor: assignedUser ? colors.success : colors.primary },
          selectedVehicle && selectedVehicle.VehicleId === item.VehicleId && { borderWidth: 2, borderColor: colors.primary }
        ]}
        onPress={() => {
          setSelectedVehicle(item);
          setShowVehicleDetails(true);
          
          if (!showListView && webViewRef.current) {
            setTimeout(() => {
              try {
                webViewRef.current.postMessage(JSON.stringify({
                  type: 'CENTER_ON_VEHICLE',
                  vehicleId: item.VehicleId
                }));
              } catch (err) {
                console.error('Error centering on vehicle:', err);
              }
            }, 100);
          }
        }}
      >
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleInfo}>
            <Ionicons 
              name="car" 
              size={20} 
              color={assignedUser ? colors.success : colors.textSecondary} 
            />
            <Text style={[styles.vehiclePlate, { color: colors.text }]} numberOfLines={1}>
              {item.VehicleRegistrationNumber || "Necunoscut"}
            </Text>
          </View>
          <Text style={[styles.vehicleSpeed, { color: colors.textSecondary }]}>
            {item.Speed || 0} km/h
          </Text>
        </View>
        
        {assignedUser && (
          <View style={[styles.assignedUserContainer, { backgroundColor: colors.success + '15' }]}>
            <View style={styles.assignedUserInfo}>
              <Ionicons name="person" size={16} color={colors.success} />
              <Text style={[styles.assignedUserName, { color: colors.text }]} numberOfLines={1}>{assignedUser.name}</Text>
            </View>
            <View style={styles.assignedUserTime}>
              <Ionicons name="time" size={14} color={colors.textSecondary} />
              <Text style={[styles.assignedUserDuration, { color: colors.textSecondary }]}>
                {getWorkDuration(assignedUser.workStartTime)}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.vehicleLocation}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={[styles.vehicleAddress, { color: colors.text }]} numberOfLines={2}>
            {item.Address || 'Locație necunoscută'}
          </Text>
        </View>
        
        <Text style={[styles.vehicleLastUpdate, { color: colors.textSecondary }]}>
          Ultima actualizare: {new Date(item.GpsDate).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };
  
  const handleManualUpdate = () => {
    if (webViewRef.current && trackGpsVehicles.length > 0) {
      console.log('Manual update - sending data to WebView');
      
      const validVehicles = trackGpsVehicles
        .map(v => ({
          ...v,
          Latitude: parseFloat(v.Latitude),
          Longitude: parseFloat(v.Longitude)
        }))
        .filter(v => 
          !isNaN(v.Latitude) && 
          !isNaN(v.Longitude) && 
          v.Latitude >= -90 && v.Latitude <= 90 && 
          v.Longitude >= -180 && v.Longitude <= 180
        );
      
      try {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'UPDATE_VEHICLES',
          vehicles: validVehicles
        }));
        
        Alert.alert('Succes', 'Harta a fost actualizată cu succes!');
      } catch (err) {
        console.error('Error updating map:', err);
        Alert.alert('Eroare', 'Nu s-a putut actualiza harta.');
      }
    } else {
      Alert.alert('Info', 'Nu există date pentru actualizare sau WebView nu este disponibil.');
    }
  };
  
  if (loading && trackGpsVehicles.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Se încarcă datele de tracking...</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="map" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tracking Ambulanțe</Text>
        </View>
        <TouchableOpacity 
          style={[styles.refreshButton, { backgroundColor: colors.inputBackground }]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={colors.primary}
            style={refreshing ? styles.refreshingIcon : null}
          />
        </TouchableOpacity>
      </View>
      
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Caută număr înmatriculare..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <TouchableOpacity 
          style={[styles.viewToggleButton, { backgroundColor: colors.inputBackground }]}
          onPress={() => setShowListView(!showListView)}
        >
          <Ionicons 
            name={showListView ? "map" : "list"} 
            size={24} 
            color={colors.primary} 
          />
        </TouchableOpacity>
      </View>
      
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : fromCache ? (
        <View style={styles.cacheBar}>
          <Ionicons name="information-circle" size={18} color="#fff" />
          <Text style={styles.cacheText}>
            Date din cache ({cacheAge ? `${Math.round(cacheAge)}s` : 'necunoscut'})
          </Text>
        </View>
      ) : null}
      
      {lastUpdated && (
        <View style={[styles.lastUpdatedBar, { backgroundColor: colors.background }]}>
          <Ionicons name="time" size={14} color={colors.textSecondary} />
          <Text style={[styles.lastUpdatedText, { color: colors.textSecondary }]}>
            Ultima actualizare: {formatTimeAgo(lastUpdated)}
          </Text>
        </View>
      )}
      
      {showListView ? (
        <FlatList
          data={filteredVehicles}
          renderItem={renderVehicleItem}
          keyExtractor={(item) => item.VehicleId.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Ionicons name="car" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                Nu există vehicule disponibile
              </Text>
              {searchTerm ? (
                <TouchableOpacity 
                  onPress={() => setSearchTerm('')}
                  style={[styles.clearSearchButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.clearSearchText}>Șterge filtrul de căutare</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: generateMapHTML() }}
            style={styles.webView}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error: ', nativeEvent);
              setError('Eroare la încărcarea hărții');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView HTTP error: ', nativeEvent);
            }}
            renderLoading={() => (
              <View style={[styles.loadingOverlay, StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Se încarcă harta...</Text>
              </View>
            )}
            onLoadEnd={() => {
              console.log('WebView loaded');
            }}
            onLoadStart={() => {
              console.log('WebView loading started');
            }}
          />
          
          {/* Floating action buttons */}
          <View style={styles.floatingButtons}>
            <TouchableOpacity 
              style={[styles.floatingButton, { backgroundColor: colors.primary }]}
              onPress={handleManualUpdate}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.floatingButton, styles.locationButton]}
              onPress={() => {
                if (webViewRef.current && trackGpsVehicles.length > 0) {
                  const validVehicles = trackGpsVehicles.filter(v => 
                    !isNaN(parseFloat(v.Latitude)) && 
                    !isNaN(parseFloat(v.Longitude))
                  );
                  
                  if (validVehicles.length > 0) {
                    try {
                      webViewRef.current.postMessage(JSON.stringify({
                        type: 'UPDATE_VEHICLES',
                        vehicles: validVehicles
                      }));
                    } catch (err) {
                      console.error('Error fitting map bounds:', err);
                    }
                  }
                }
              }}
            >
              <Ionicons name="locate" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Vehicle count indicator */}
      <View style={[styles.vehicleCountContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.vehicleCountText, { color: colors.text }]}>
          {filteredVehicles.length} vehicule{filteredVehicles.length !== 1 ? '' : ''}
          {searchTerm ? ` (filtrate)` : ''}
        </Text>
        {activeUsers.length > 0 && (
          <Text style={[styles.activeUsersText, { color: colors.textSecondary }]}>
            {activeUsers.length} utilizatori activi
          </Text>
        )}
      </View>
      
      {/* Modal pentru detalii vehicul */}
      <Modal
        visible={showVehicleDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVehicleDetails(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedVehicle?.VehicleRegistrationNumber || selectedVehicle?.VehicleName}
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => setShowVehicleDetails(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedVehicle && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Detalii vehicul */}
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Informații Vehicul</Text>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Număr:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.VehicleRegistrationNumber}</Text>
                  </View>
                  {selectedVehicle.VehicleName && selectedVehicle.VehicleName !== selectedVehicle.VehicleRegistrationNumber && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Nume:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.VehicleName}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Viteză:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.Speed || 0} km/h</Text>
                  </View>
                  {selectedVehicle.Course && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Direcție:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.Course}°</Text>
                    </View>
                  )}
                  {selectedVehicle.ExternalPowerVoltage && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Tensiune:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.ExternalPowerVoltage}V</Text>
                    </View>
                  )}
                </View>
                
                {/* Detalii locație */}
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Informații Locație</Text>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Adresă:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.Address || 'Necunoscută'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Coordonate:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {parseFloat(selectedVehicle.Latitude).toFixed(6)}, {parseFloat(selectedVehicle.Longitude).toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ultima actualizare GPS:</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {new Date(selectedVehicle.GpsDate).toLocaleString()}
                    </Text>
                  </View>
                  {selectedVehicle.ServerDate && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Actualizare server:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {new Date(selectedVehicle.ServerDate).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Informații motor */}
                {selectedVehicle.EngineEvent !== undefined && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Stare Motor</Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Stare:</Text>
                      <Text style={[styles.detailValue, { 
                        color: selectedVehicle.EngineEvent === 1 ? colors.success : colors.error 
                      }]}>
                        {selectedVehicle.EngineEvent === 1 ? 'Pornit' : 'Oprit'}
                      </Text>
                    </View>
                    {selectedVehicle.EngineEventDate && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ultima schimbare:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {new Date(selectedVehicle.EngineEventDate).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                {/* Informații asistent */}
                {findAssignedUser(selectedVehicle) && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Asistent Medical</Text>
                    <View style={[styles.assistantInfo, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
                      <View style={styles.assistantRow}>
                        <Ionicons name="person" size={20} color={colors.success} />
                        <Text style={[styles.assistantName, { color: colors.text }]}>{findAssignedUser(selectedVehicle).name}</Text>
                      </View>
                      <View style={styles.assistantRow}>
                        <Ionicons name="time" size={20} color={colors.textSecondary} />
                        <Text style={[styles.assistantTime, { color: colors.textSecondary }]}>
                          Durată tură: {getWorkDuration(findAssignedUser(selectedVehicle).workStartTime)}
                        </Text>
                      </View>
                      {findAssignedUser(selectedVehicle).phone && (
                        <View style={styles.assistantRow}>
                          <Ionicons name="call" size={20} color={colors.primary} />
                          <Text style={[styles.assistantPhone, { color: colors.primary }]}>
                            {findAssignedUser(selectedVehicle).phone}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
                
                {/* Informații grup */}
                {selectedVehicle.GroupName && selectedVehicle.GroupName !== 'No group' && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>Grup</Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Nume grup:</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.GroupName}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
            
            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.centerOnMapButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowVehicleDetails(false);
                  setShowListView(false);
                  
                  // Centrează harta pe vehicul
                  if (selectedVehicle && webViewRef.current) {
                    setTimeout(() => {
                      try {
                        webViewRef.current.postMessage(JSON.stringify({
                          type: 'CENTER_ON_VEHICLE',
                          vehicleId: selectedVehicle.VehicleId
                        }));
                      } catch (err) {
                        console.error('Error centering on vehicle:', err);
                      }
                    }, 500);
                  }
                }}
              >
                <Ionicons name="locate" size={20} color="#fff" />
                <Text style={styles.centerOnMapText}>Centrează pe hartă</Text>
              </TouchableOpacity>
              
              {findAssignedUser(selectedVehicle) && findAssignedUser(selectedVehicle).phone && (
                <TouchableOpacity 
                  style={[styles.callButton, { backgroundColor: colors.success }]}
                  onPress={() => {
                    const phone = findAssignedUser(selectedVehicle).phone;
                    Alert.alert(
                      'Apelare',
                      `Doriți să apelați numărul ${phone}?`,
                      [
                        { text: 'Anulează', style: 'cancel' },
                        { 
                          text: 'Apelează', 
                          onPress: () => {
                            // Here you would implement phone calling functionality
                            // For example: Linking.openURL(`tel:${phone}`)
                            Alert.alert('Info', 'Funcționalitatea de apelare va fi implementată.');
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.callButtonText}>Apelează asistent</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Updated styles with dynamic colors support
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  refreshingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  viewToggleButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderRadius: 8,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  cacheBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a2b8',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cacheText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  lastUpdatedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lastUpdatedText: {
    marginLeft: 8,
    fontSize: 12,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  floatingButtons: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  floatingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  locationButton: {
    backgroundColor: '#28a745',
  },
  vehicleCountContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  vehicleCountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeUsersText: {
    fontSize: 12,
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  vehicleItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  vehicleSpeed: {
    fontSize: 14,
    fontWeight: '500',
  },
  assignedUserContainer: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  assignedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedUserName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  assignedUserTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 24,
  },
  assignedUserDuration: {
    fontSize: 12,
    marginLeft: 4,
  },
  vehicleLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vehicleAddress: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  vehicleLastUpdate: {
    fontSize: 12,
  },
  emptyListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyListText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  modalBody: {
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingVertical: 2,
  },
  detailLabel: {
    width: 120,
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
  },
  assistantInfo: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  assistantName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  assistantTime: {
    fontSize: 14,
    marginLeft: 8,
  },
  assistassistantPhone: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  centerOnMapButton: {
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  centerOnMapText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  callButton: {
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TrackingScreen;