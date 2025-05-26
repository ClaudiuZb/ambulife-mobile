import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../utils/config';
import store from '../redux/store';
import { setAlert } from '../redux/actions/uiActions';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        console.log('No token found, skipping socket connection');
        return;
      }

      this.socket = io(config.SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected = true;
      
      // Join user's city room
      const user = store.getState().auth.user;
      if (user?.city) {
        this.joinCityRoom(user.city);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Curse events
    this.socket.on('new_course_assigned', (data) => {
      console.log('New course assigned:', data);
      store.dispatch(setAlert('Ai primit o cursă nouă!', 'info'));
      // Aici poți adăuga push notification
    });

    // Chat events
    this.socket.on('new_message', (data) => {
      console.log('New message:', data);
      // Dispatch action pentru a actualiza chat-ul
    });

    // Vehicle tracking events
    this.socket.on('vehicle_position_update', (data) => {
      console.log('Vehicle position update:', data);
      // Dispatch action pentru a actualiza poziția pe hartă
    });

    // Mechanic alerts
    this.socket.on('new_technical_problem', (data) => {
      console.log('New technical problem:', data);
      store.dispatch(setAlert('Problemă tehnică nouă raportată!', 'warning'));
    });
  }

  // Join city room
  joinCityRoom(cityId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_city', cityId);
      console.log(`Joined city room: ${cityId}`);
    }
  }

  // Leave city room
  leaveCityRoom(cityId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_city', cityId);
    }
  }

  // Send message
  sendMessage(message) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', message);
    }
  }

  // Update vehicle position
  updateVehiclePosition(position) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update_position', position);
    }
  }

  // Report technical problem
  reportProblem(problemData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('report_problem', problemData);
    }
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export default new SocketService();