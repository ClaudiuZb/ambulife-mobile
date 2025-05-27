import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 TextInput,
 FlatList,
 ActivityIndicator,
 Modal,
 Alert,
 KeyboardAvoidingView,
 Platform,
 StatusBar,
 ScrollView,
 Image,
 useColorScheme,
 Dimensions,
 RefreshControl,
 Linking,
 Appearance
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../utils/axios';
import { colors as baseColors } from '../../utils/colors';
import io from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import config from '../../utils/config';

const { height: screenHeight } = Dimensions.get('window');

const ChatScreen = ({ navigation }) => {
 const { user } = useSelector(state => state.auth);
 const systemColorScheme = useColorScheme();
 const isDark = true;
 
 const colors = {
   ...baseColors,
   background: '#000000',
   card: '#1c1c1e',
   text: '#ffffff',
   textSecondary: '#8e8e93',
   border: '#38383a',
   inputBackground: '#2c2c2e',
   modalBackground: 'rgba(0, 0, 0, 0.8)',
   messageBackground: '#2c2c2e',
   myMessageBackground: '#0066cc',
   chatBackground: '#000000',
   primary: baseColors.primary || '#007BFF',
   success: baseColors.success || '#28a745',
   warning: baseColors.warning || '#ffc107',
   error: baseColors.error || '#dc3545',
   info: baseColors.info || '#17a2b8'
 };

 const [chats, setChats] = useState([]);
 const [selectedChat, setSelectedChat] = useState(null);
 const [messages, setMessages] = useState([]);
 const [newMessage, setNewMessage] = useState('');
 const [loading, setLoading] = useState(false);
 const [messagesLoading, setMessagesLoading] = useState(false);
 const [typingUsers, setTypingUsers] = useState([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [showSearch, setShowSearch] = useState(false);
 const [replyTo, setReplyTo] = useState(null);
 const [page, setPage] = useState(1);
 const [hasMore, setHasMore] = useState(true);
 const [socket, setSocket] = useState(null);
 const [error, setError] = useState(null);
 const [refreshing, setRefreshing] = useState(false);
 
 const [showNewChatModal, setShowNewChatModal] = useState(false);
 const [showNewGroupModal, setShowNewGroupModal] = useState(false);
 const [showMessageActions, setShowMessageActions] = useState(false);
 const [selectedMessage, setSelectedMessage] = useState(null);
 const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
 
 const [availableUsers, setAvailableUsers] = useState([]);
 const [selectedUsers, setSelectedUsers] = useState([]);
 const [newGroupName, setNewGroupName] = useState('');
 const [userSearchTerm, setUserSearchTerm] = useState('');
 
 const flatListRef = useRef(null);
 const typingTimeoutRef = useRef(null);
 const requestPendingRef = useRef(false);

 useEffect(() => {
   const initializeSocket = async () => {
     if (user) {
       try {
         const token = await AsyncStorage.getItem('token');
         
         if (!token) {
           console.error('No token found for socket connection');
           return;
         }

         console.log('Initializing socket connection with token:', token.substring(0, 20) + '...');
         
         const newSocket = io(config.SOCKET_URL, {
           auth: {
             token: token
           },
           transports: ['websocket', 'polling']
         });
         
         setSocket(newSocket);
         
         newSocket.on('connect', () => {
           console.log('Socket connected successfully');
         });
         
         newSocket.on('connect_error', (error) => {
           console.error('Socket connection error:', error);
           setError(`Eroare conexiune chat: ${error.message}`);
         });
         
         newSocket.on('disconnect', (reason) => {
           console.log('Socket disconnected:', reason);
         });
         
         newSocket.on('typing', (data) => {
           if (selectedChat && selectedChat._id === data.chatId) {
             setTypingUsers(data.users || []);
           }
         });
         
         newSocket.on('stop_typing', (data) => {
           if (selectedChat && selectedChat._id === data.chatId) {
             setTypingUsers(prev => prev.filter(userId => userId !== data.userId));
           }
         });
         
         newSocket.on('new_message', (newMessage) => {
           console.log('New message received:', newMessage);
           if (selectedChat && selectedChat._id === newMessage.chat) {
             setMessages(prev => [newMessage, ...prev]);
             markMessageAsRead(newMessage._id, newMessage.chat);
             updateChatLastMessage(newMessage);
           } else {
             updateUnreadCount(newMessage.chat);
           }
         });
         
         newSocket.on('message_deleted_for_all', ({ messageId, chatId }) => {
           if (selectedChat && selectedChat._id === chatId) {
             setMessages(prev => prev.map(msg => 
               msg._id === messageId ? { ...msg, deletedForAll: true } : msg
             ));
           }
         });
         
         newSocket.on('message_read', ({ messageId, chatId, userId }) => {
           if (selectedChat && selectedChat._id === chatId) {
             setMessages(prev => prev.map(msg => 
               msg._id === messageId ? { 
                 ...msg, 
                 read: [...(msg.read || []), { user: userId, readAt: new Date() }] 
               } : msg
             ));
           }
         });
         
         newSocket.on('group_deleted', ({ chatId }) => {
           setChats(prev => prev.filter(chat => chat._id !== chatId));
           if (selectedChat && selectedChat._id === chatId) {
             setSelectedChat(null);
             Alert.alert('Notificare', 'Grupul a fost șters');
           }
         });
         
       } catch (error) {
         console.error('Error initializing socket:', error);
         setError('Nu s-a putut conecta la serviciul de chat');
       }
     }
   };

   initializeSocket();
   
   return () => {
     if (socket) {
       console.log('Disconnecting socket...');
       socket.disconnect();
     }
   };
 }, [user]);

 useEffect(() => {
   if (socket && selectedChat) {
     console.log('Joining chat room:', selectedChat._id);
     socket.emit('join_chat', selectedChat._id);
     
     setMessages([]);
     setPage(1);
     setHasMore(true);
   }
 }, [socket, selectedChat]);

 const fetchChats = useCallback(async () => {
   if (requestPendingRef.current) return;
   
   requestPendingRef.current = true;
   setLoading(true);
   
   try {
     const res = await axios.get('/chat');
     
     if (res.data.success) {
       setChats(res.data.data);
       setError(null);
     } else {
       setError('Nu s-au putut obține chat-urile');
     }
   } catch (err) {
     console.error('Eroare la obținerea chat-urilor:', err);
     setError(err.response?.data?.message || 'Eroare la obținerea chat-urilor');
   } finally {
     setLoading(false);
     setRefreshing(false);
     requestPendingRef.current = false;
   }
 }, []);

 const fetchAvailableUsers = async () => {
   try {
     const res = await axios.get('/users');
     
     if (res.data.success) {
       setAvailableUsers(res.data.data.filter(u => u._id !== user._id));
     } else {
       setError('Nu s-au putut obține utilizatorii');
     }
   } catch (err) {
     console.error('Eroare la obținerea utilizatorilor:', err);
     setError(err.response?.data?.message || 'Eroare la obținerea utilizatorilor');
   }
 };

 const fetchMessages = useCallback(async () => {
   if (!selectedChat) return;
   
   setMessagesLoading(true);
   
   try {
     const res = await axios.get(`/messages/${selectedChat._id}?page=1`);
     
     if (res.data.success) {
       setMessages(res.data.data);
       setHasMore(res.data.pagination.next !== undefined);
       setError(null);
       
       markChatAsRead(selectedChat._id);
       updateChatUnreadCount(selectedChat._id, 0);
     } else {
       setError('Nu s-au putut obține mesajele');
     }
   } catch (err) {
     console.error('Eroare la obținerea mesajelor:', err);
     setError(err.response?.data?.message || 'Eroare la obținerea mesajelor');
   } finally {
     setMessagesLoading(false);
   }
 }, [selectedChat]);

 useEffect(() => {
   if (user) {
     fetchChats();
   }
 }, [user, fetchChats]);

 useEffect(() => {
   fetchMessages();
 }, [selectedChat, fetchMessages]);

 const updateUnreadCount = (chatId) => {
   setChats(prev => prev.map(chat => {
     if (chat._id === chatId) {
       return {
         ...chat,
         unreadCount: (chat.unreadCount || 0) + 1
       };
     }
     return chat;
   }));
 };

 const updateChatLastMessage = (message) => {
   setChats(prev => prev.map(chat => {
     if (chat._id === message.chat) {
       return {
         ...chat,
         latestMessage: message
       };
     }
     return chat;
   }));
 };

 const updateChatUnreadCount = (chatId, count) => {
   setChats(prev => prev.map(chat => {
     if (chat._id === chatId) {
       return {
         ...chat,
         unreadCount: count
       };
     }
     return chat;
   }));
 };

 const markChatAsRead = async (chatId) => {
   try {
     await axios.put('/messages/read', { chatId });
   } catch (error) {
     console.error('Eroare la marcarea chat-ului ca citit:', error);
   }
 };

 const markMessageAsRead = async (messageId, chatId) => {
   try {
     await axios.put('/messages/read', { messageId, chatId });
   } catch (error) {
     console.error('Eroare la marcarea mesajului ca citit:', error);
   }
 };

 const createPrivateChat = async (userId) => {
   try {
     const res = await axios.post('/chat/private', { userId });
     
     if (res.data.success) {
       setChats(prev => [res.data.data, ...prev]);
       setSelectedChat(res.data.data);
       setShowNewChatModal(false);
     } else {
       setError('Nu s-a putut crea conversația');
     }
   } catch (err) {
     console.error('Eroare la crearea conversației:', err);
     setError(err.response?.data?.message || 'Eroare la crearea conversației');
   }
 };

 const createGroupChat = async () => {
   if (!newGroupName.trim() || selectedUsers.length < 2) {
     Alert.alert('Eroare', 'Completați numele grupului și selectați cel puțin 2 utilizatori');
     return;
   }
   
   try {
     const res = await axios.post('/chat/group', {
       name: newGroupName,
       users: selectedUsers
     });
     
     if (res.data.success) {
       setChats(prev => [res.data.data, ...prev]);
       setSelectedChat(res.data.data);
       setNewGroupName('');
       setSelectedUsers([]);
       setShowNewGroupModal(false);
     } else {
       setError('Nu s-a putut crea grupul');
     }
   } catch (err) {
     console.error('Eroare la crearea grupului:', err);
     setError(err.response?.data?.message || 'Eroare la crearea grupului');
   }
 };

 const deleteGroup = async (chatId) => {
   try {
     setLoading(true);
     const res = await axios.delete(`/chat/group/${chatId}`);
     
     if (res.data.success) {
       setChats(prev => prev.filter(chat => chat._id !== chatId));
       setSelectedChat(null);
       Alert.alert('Succes', 'Grupul a fost șters cu succes');
     } else {
       setError('Nu s-a putut șterge grupul');
     }
   } catch (err) {
     console.error('Eroare la ștergerea grupului:', err);
     setError(err.response?.data?.message || 'Eroare la ștergerea grupului');
   } finally {
     setLoading(false);
   }
 };

 const sendMessage = async () => {
   if (newMessage.trim() === '' && !replyTo) return;
   
   try {
     const messageData = {
       content: newMessage,
       chatId: selectedChat._id
     };
     
     if (replyTo) {
       messageData.replyToId = replyTo._id;
     }

     const optimisticMessage = {
       _id: Date.now().toString(),
       content: newMessage,
       sender: user,
       chat: selectedChat._id,
       createdAt: new Date().toISOString(),
       read: [],
       replyTo: replyTo
     };

     setMessages(prev => [optimisticMessage, ...prev]);
     
     stopTyping();
     setNewMessage('');
     setReplyTo(null);
     
     const res = await axios.post('/messages', messageData);
     
     if (res.data.success) {
       setMessages(prev => prev.map(msg => 
         msg._id === optimisticMessage._id ? res.data.data : msg
       ));
       updateChatLastMessage(res.data.data);
     } else {
       setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
       setError('Nu s-a putut trimite mesajul');
     }
   } catch (error) {
     setMessages(prev => prev.filter(msg => msg._id !== Date.now().toString()));
     console.error('Eroare la trimiterea mesajului:', error);
     setError(error.response?.data?.message || 'Eroare la trimiterea mesajului');
   }
 };

 const startTyping = () => {
   if (!socket || !selectedChat) return;
   
   socket.emit('typing', { chatId: selectedChat._id, userId: user._id });
   
   if (typingTimeoutRef.current) {
     clearTimeout(typingTimeoutRef.current);
   }
   
   typingTimeoutRef.current = setTimeout(stopTyping, 3000);
 };

 const stopTyping = () => {
   if (!socket || !selectedChat) return;
   
   socket.emit('stop_typing', { chatId: selectedChat._id, userId: user._id });
   
   if (typingTimeoutRef.current) {
     clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = null;
   }
 };

 const handleInputChange = (text) => {
   setNewMessage(text);
   
   if (text.trim() !== '' && typingUsers.indexOf(user._id) === -1) {
     startTyping();
   }
 };

 const deleteMessage = async (messageId, deleteForAll = false) => {
   try {
     await axios.delete(`/messages/${messageId}${deleteForAll ? '?deleteForAll=true' : ''}`);
     
     if (!deleteForAll) {
       setMessages(prev => prev.filter(msg => msg._id !== messageId));
     }
     
     setShowMessageActions(false);
     setSelectedMessage(null);
   } catch (error) {
     console.error('Eroare la ștergerea mesajului:', error);
     Alert.alert('Eroare', 'Nu s-a putut șterge mesajul');
   }
 };

 const handleImagePicker = async () => {
   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
   
   if (status !== 'granted') {
     Alert.alert('Permisiune necesară', 'Este necesară permisiunea pentru galerie');
     return;
   }

   const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: ImagePicker.MediaTypeOptions.Images,
     quality: 0.8,
   });

   if (!result.canceled) {
     uploadAttachment(result.assets[0]);
   }
   
   setShowAttachmentOptions(false);
 };

 const handleCameraPicker = async () => {
   const { status } = await ImagePicker.requestCameraPermissionsAsync();
   
   if (status !== 'granted') {
     Alert.alert('Permisiune necesară', 'Este necesară permisiunea pentru cameră');
     return;
   }

   const result = await ImagePicker.launchCameraAsync({
     mediaTypes: ImagePicker.MediaTypeOptions.Images,
     quality: 0.8,
   });

   if (!result.canceled) {
     uploadAttachment(result.assets[0]);
   }
   
   setShowAttachmentOptions(false);
 };

 const handleDocumentPicker = async () => {
   try {
     const result = await DocumentPicker.getDocumentAsync({
       type: ['application/pdf', 'image/*'],
       copyToCacheDirectory: true,
     });

     if (result.type === 'success') {
       uploadAttachment(result);
     }
   } catch (err) {
     console.error('Error picking document:', err);
   }
   
   setShowAttachmentOptions(false);
 };

 const uploadAttachment = async (file) => {
   const formData = new FormData();
   formData.append('file', {
     uri: file.uri,
     name: file.name || 'file',
     type: file.mimeType || 'application/octet-stream',
   });
   formData.append('chatId', selectedChat._id);
   
   if (replyTo) {
     formData.append('replyToId', replyTo._id);
   }
   
   if (newMessage.trim() !== '') {
     formData.append('content', newMessage);
   }
   
   try {
     const res = await axios.post('/messages/attachment', formData, {
       headers: {
         'Content-Type': 'multipart/form-data'
       }
     });
     
     if (res.data.success) {
       setNewMessage('');
       setReplyTo(null);
       setMessages(prev => [res.data.data, ...prev]);
       updateChatLastMessage(res.data.data);
     } else {
       throw new Error('Eroare la încărcarea atașamentului');
     }
   } catch (error) {
     console.error('Eroare la încărcarea atașamentului:', error);
     Alert.alert('Eroare', 'Nu s-a putut încărca atașamentul');
   }
 };

 const handleDownloadAttachment = async (message) => {
   try {
     setLoading(true);
     
     const token = await AsyncStorage.getItem('token');
     if (!token) {
       throw new Error('Token lipsă');
     }
     
     const fileName = message.attachmentName || `attachment_${message._id}`;
     const fileUri = FileSystem.documentDirectory + fileName;
     
     console.log('Încercare descărcare fișier de la:', `${config.API_URL}/messages/attachment/${message._id}`);
     
     const downloadResult = await FileSystem.downloadAsync(
       `${config.API_URL}/messages/attachment/${message._id}`,
       fileUri,
       {
         headers: {
           Authorization: `Bearer ${token}`
         }
       }
     );
     
     console.log('Rezultat descărcare:', downloadResult);
     
     if (downloadResult.status === 200) {
       if (await Sharing.isAvailableAsync()) {
         await Sharing.shareAsync(downloadResult.uri);
       } else {
         Alert.alert('Succes', 'Fișierul a fost descărcat');
       }
     } else {
       throw new Error(`Eroare la descărcarea fișierului. Status: ${downloadResult.status}`);
     }
   } catch (error) {
     console.error('Eroare la descărcarea atașamentului:', error);
     Alert.alert(
       'Eroare la descărcare', 
       `Nu s-a putut descărca fișierul. Detalii: ${error.message}`,
       [
         { 
           text: 'Încearcă din nou', 
           onPress: () => handleDownloadAttachment(message) 
         },
         { 
           text: 'Anulează' 
         }
       ]
     );
   } finally {
     setLoading(false);
   }
 };

 const toggleUserSelection = (userId) => {
   if (selectedUsers.includes(userId)) {
     setSelectedUsers(prev => prev.filter(id => id !== userId));
   } else {
     setSelectedUsers(prev => [...prev, userId]);
   }
 };

 const filteredChats = chats.filter(chat => 
   chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
   (chat.latestMessage && chat.latestMessage.content && 
    chat.latestMessage.content.toLowerCase().includes(searchTerm.toLowerCase()))
 );

 const filteredAvailableUsers = availableUsers.filter(u => 
   u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
   (u.email && u.email.toLowerCase().includes(userSearchTerm.toLowerCase()))
 );

 const formatTime = (date) => {
   return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 };

 const formatDate = (date) => {
   const today = new Date();
   const messageDate = new Date(date);
   
   if (today.toDateString() === messageDate.toDateString()) {
     return 'Astăzi';
   } else if (today.getDate() - messageDate.getDate() === 1) {
     return 'Ieri';
   } else {
     return messageDate.toLocaleDateString();
   }
 };

 const getChatDisplayName = (chat) => {
   if (chat.isGroupChat) {
     return chat.name;
   } else {
     const otherUser = chat.users.find(u => u._id !== user._id);
     return otherUser ? otherUser.name : 'Chat';
   }
 };

 const getChatAvatar = (chat) => {
   if (chat.isGroupChat) {
     return chat.name.charAt(0).toUpperCase();
   } else {
     const otherUser = chat.users.find(u => u._id !== user._id);
     return otherUser ? otherUser.name.charAt(0).toUpperCase() : '?';
   }
 };

 const isGroupAdmin = (chat) => {
   if (!chat || !chat.isGroupChat) return false;
   return (chat.groupAdmin && chat.groupAdmin._id === user._id) || user.role === 'admin';
 };

 const renderMessage = ({ item, index }) => {
   const isMine = item.sender._id === user._id;
   const isDeleted = item.deletedForAll;
   const showSender = selectedChat.isGroupChat && !isMine && !isDeleted;
   
   return (
     <TouchableOpacity
       style={[
         styles.messageContainer,
         isMine ? styles.myMessageContainer : styles.otherMessageContainer
       ]}
       onLongPress={() => {
         setSelectedMessage(item);
         setShowMessageActions(true);
       }}
     >
       {item.replyTo && (
         <View style={[styles.replyContainer, { backgroundColor: colors.inputBackground }]}>
           <Text style={[styles.replyName, { color: colors.primary }]}>
             {item.replyTo.sender.name}
           </Text>
           <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
             {item.replyTo.deletedForAll ? (
               'Acest mesaj a fost șters'
             ) : (
               item.replyTo.content || 
               (item.replyTo.attachmentType ? `[${
                 item.replyTo.attachmentType === 'image' ? 'Imagine' :
                 item.replyTo.attachmentType === 'audio' ? 'Audio' :
                 item.replyTo.attachmentType === 'video' ? 'Video' : 'Document'
               }]` : '')
             )}
           </Text>
         </View>
       )}
       
       <View 
         style={[
           styles.messageBubble,
           {
             backgroundColor: isMine ? colors.myMessageBackground : colors.messageBackground,
           },
           isDeleted && styles.deletedMessage
         ]}
       >
         {showSender && (
           <Text style={[styles.senderName, { color: colors.primary }]}>
             {item.sender.name}
           </Text>
         )}
         
         {isDeleted ? (
           <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
             Acest mesaj a fost șters
           </Text>
         ) : (
           <>
             {item.content && (
               <Text style={[styles.messageText, { color: isMine ? '#fff' : colors.text }]}>
                 {item.content}
               </Text>
             )}
             
             {item.attachment && (
               <TouchableOpacity 
                 style={styles.attachmentContainer}
                 onPress={() => handleDownloadAttachment(item)}
               >
                 {item.attachmentType === 'image' ? (
                   <Image 
                     source={{ 
                       uri: `${config.API_URL}/messages/attachment/${item._id}`,
                       headers: {
                         Authorization: `Bearer ${AsyncStorage.getItem('token')}`
                       }
                     }}
                     style={styles.attachmentImage}
                     resizeMode="cover"
                   />
                 ) : (
                   <View style={[styles.documentAttachment, { backgroundColor: colors.inputBackground }]}>
                     <Ionicons 
                       name={
                         item.attachmentType === 'audio' ? 'musical-note' :
                         item.attachmentType === 'video' ? 'videocam' :
                         'document'
                       } 
                       size={24} 
                       color={colors.primary} 
                     />
                     <View style={styles.documentInfo}>
                       <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                         {item.attachmentName || 'Document'}
                       </Text>
                       <Text style={[styles.attachmentSize, { color: colors.textSecondary }]}>
                         Apasă pentru a descărca
                       </Text>
                     </View>
                     <Ionicons name="download-outline" size={20} color={colors.primary} />
                   </View>
                 )}
               </TouchableOpacity>
             )}
             
             <View style={styles.messageTimeContainer}>
               <Text style={[styles.messageTime, { color: isMine ? '#fff' : colors.textSecondary }]}>
                 {formatTime(item.createdAt)}
               </Text>
               {isMine && (
                 <Ionicons 
                   name={item.read && item.read.length > 0 ? "checkmark-done" : "checkmark"} 
                   size={14} 
                   color={item.read && item.read.length > 0 ? colors.info : "#fff"}
                   style={{ marginLeft: 4 }}
                 />
               )}
             </View>
           </>
         )}
       </View>
     </TouchableOpacity>
   );
 };

 useEffect(() => {
   if (error) {
     Alert.alert('Eroare', error, [
       { text: 'OK', onPress: () => setError(null) }
     ]);
   }
 }, [error]);

 const onRefresh = () => {
   setRefreshing(true);
   fetchChats();
 };

 if (loading && chats.length === 0) {
   return (
     <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
       <ActivityIndicator size="large" color={colors.primary} />
       <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Se încarcă chat-urile...</Text>
     </View>
   );
 }

 return (
   <View style={[styles.container, { backgroundColor: colors.background }]}>
     <StatusBar barStyle="light-content" backgroundColor={colors.background} />
     
     {selectedChat ? (
       <View style={[styles.chatContainer, { backgroundColor: colors.chatBackground }]}>
         <KeyboardAvoidingView 
           style={{ flex: 1 }} 
           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
           keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
         >
           <View style={[styles.chatHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
             <TouchableOpacity
               style={styles.backButton}
               onPress={() => setSelectedChat(null)}
             >
               <Ionicons name="arrow-back" size={24} color={colors.text} />
           </TouchableOpacity>
           
           <View style={[styles.avatar, { backgroundColor: selectedChat.isGroupChat ? colors.primary : colors.success }]}>
             <Text style={styles.avatarText}>{getChatAvatar(selectedChat)}</Text>
           </View>
           
           <View style={styles.headerInfo}>
             <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
               {getChatDisplayName(selectedChat)}
             </Text>
             <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
               {selectedChat.isGroupChat 
                 ? `${selectedChat.users.length} participanți` 
                 : 'Online'}
             </Text>
           </View>
           
           <TouchableOpacity
             style={styles.headerAction}
             onPress={() => setShowSearch(!showSearch)}
           >
             <Ionicons name="search" size={24} color={colors.primary} />
           </TouchableOpacity>
           
           {selectedChat.isGroupChat && isGroupAdmin(selectedChat) && (
             <TouchableOpacity
               style={styles.headerAction}
               onPress={() => {
                 Alert.alert(
                   'Confirmare',
                   'Ești sigur că vrei să ștergi acest grup? Această acțiune nu poate fi anulată.',
                   [
                     { text: 'Anulare', style: 'cancel' },
                     { 
                       text: 'Șterge', 
                       style: 'destructive', 
                       onPress: () => deleteGroup(selectedChat._id) 
                     }
                   ]
                 );
               }}
             >
               <Ionicons name="trash" size={24} color={colors.error} />
             </TouchableOpacity>
           )}
         </View>
         
         {replyTo && (
           <View style={[styles.replyIndicator, { backgroundColor: colors.inputBackground, borderLeftColor: colors.primary }]}>
             <View style={styles.replyContent}>
               <Ionicons name="arrow-undo" size={16} color={colors.primary} />
               <View style={styles.replyInfo}>
                 <Text style={[styles.replyToName, { color: colors.primary }]}>
                   Răspuns către {replyTo.sender.name}
                 </Text>
                 <Text style={[styles.replyToText, { color: colors.textSecondary }]} numberOfLines={1}>
                   {replyTo.deletedForAll ? (
                     'Acest mesaj a fost șters'
                   ) : replyTo.content ? (
                     replyTo.content
                   ) : (
                     `[${
                      replyTo.attachmentType === 'image' ? 'Imagine' :
                     replyTo.attachmentType === 'audio' ? 'Audio' :
                       replyTo.attachmentType === 'video' ? 'Video' : 'Document'
                     }]`
                   )}
                 </Text>
               </View>
             </View>
             <TouchableOpacity onPress={() => setReplyTo(null)}>
               <Ionicons name="close" size={20} color={colors.textSecondary} />
             </TouchableOpacity>
           </View>
         )}
         
         <FlatList
           ref={flatListRef}
           data={messages}
           keyExtractor={(item) => item._id}
           renderItem={renderMessage}
           style={[styles.messagesList, { backgroundColor: colors.chatBackground }]}
           contentContainerStyle={[styles.messagesContent, { backgroundColor: colors.chatBackground }]}
           showsVerticalScrollIndicator={false}
           inverted={true}
           keyboardShouldPersistTaps="handled"
           ListEmptyComponent={
             messagesLoading ? (
               <View style={styles.messagesLoading}>
                 <ActivityIndicator size="large" color={colors.primary} />
                 <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Se încarcă mesajele...</Text>
               </View>
             ) : (
               <View style={styles.emptyMessages}>
                 <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
                 <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                   Nu există mesaje în această conversație
                 </Text>
                 <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                   Trimite primul mesaj pentru a începe conversația!
                 </Text>
               </View>
             )
           }
           ListHeaderComponent={
             typingUsers.length > 0 && (
               <View style={styles.typingIndicator}>
                 <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                   {typingUsers.length === 1 ? 'Un utilizator scrie...' : 'Mai mulți utilizatori scriu...'}
                 </Text>
               </View>
             )
           }
         />
         
         {showAttachmentOptions && (
           <View style={[styles.attachmentOptions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
             <TouchableOpacity style={styles.attachmentOption} onPress={handleCameraPicker}>
               <View style={[styles.attachmentIcon, { backgroundColor: colors.primary }]}>
                 <Ionicons name="camera" size={24} color="#fff" />
               </View>
               <Text style={[styles.attachmentLabel, { color: colors.text }]}>Cameră</Text>
             </TouchableOpacity>
             
             <TouchableOpacity style={styles.attachmentOption} onPress={handleImagePicker}>
               <View style={[styles.attachmentIcon, { backgroundColor: colors.success }]}>
                 <Ionicons name="images" size={24} color="#fff" />
               </View>
               <Text style={[styles.attachmentLabel, { color: colors.text }]}>Galerie</Text>
             </TouchableOpacity>
             
             <TouchableOpacity style={styles.attachmentOption} onPress={handleDocumentPicker}>
               <View style={[styles.attachmentIcon, { backgroundColor: colors.warning }]}>
                 <Ionicons name="document" size={24} color="#fff" />
               </View>
               <Text style={[styles.attachmentLabel, { color: colors.text }]}>Document</Text>
             </TouchableOpacity>
           </View>
         )}
         
         <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
           <TouchableOpacity
             style={styles.attachmentButton}
             onPress={() => setShowAttachmentOptions(!showAttachmentOptions)}
           >
             <Ionicons name="attach" size={24} color={colors.primary} />
           </TouchableOpacity>
           
           <TextInput
             style={[styles.messageInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
             placeholder="Scrie un mesaj..."
             placeholderTextColor={colors.textSecondary}
             value={newMessage}
             onChangeText={handleInputChange}
             onBlur={stopTyping}
             multiline
             maxLength={1000}
             textAlignVertical="top"
             returnKeyType="send"
             onSubmitEditing={sendMessage}
             blurOnSubmit={false}
           />
           
           <TouchableOpacity
             style={[
               styles.sendButton, 
               { 
                 backgroundColor: newMessage.trim() === '' ? colors.textSecondary : colors.primary 
               }
             ]}
             onPress={sendMessage}
             disabled={newMessage.trim() === ''}
           >
             <Ionicons name="send" size={20} color="#fff" />
           </TouchableOpacity>
         </View>
       </KeyboardAvoidingView>
       </View>
     ) : (
       <View style={styles.chatListContainer}>
         <View style={[styles.listHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
           <Text style={[styles.headerTitle, { color: colors.text }]}>Chat Ambu Life</Text>
           <View style={styles.headerActions}>
             <TouchableOpacity
               style={[styles.headerButton, { backgroundColor: colors.inputBackground }]}
               onPress={onRefresh}
               disabled={loading}
             >
               <Ionicons 
                 name="refresh" 
                 size={20} 
                 color={colors.primary}
                 style={refreshing ? { transform: [{ rotate: '180deg' }] } : null}
               />
             </TouchableOpacity>
             
             <TouchableOpacity
               style={[styles.headerButton, { backgroundColor: colors.primary }]}
               onPress={() => {
                 fetchAvailableUsers();
                 setShowNewChatModal(true);
               }}
             >
               <Ionicons name="add" size={20} color="#fff" />
             </TouchableOpacity>
           </View>
         </View>
         
         <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
           <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
             <Ionicons name="search" size={20} color={colors.textSecondary} />
             <TextInput
               style={[styles.searchInput, { color: colors.text }]}
               placeholder="Caută în conversații..."
               placeholderTextColor={colors.textSecondary}
               value={searchTerm}
               onChangeText={setSearchTerm}
             />
           </View>
         </View>
         
         <FlatList
           data={filteredChats}
           keyExtractor={(item) => item._id}
           renderItem={({ item }) => (
             <TouchableOpacity
               style={[styles.chatItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
               onPress={() => setSelectedChat(item)}
               onLongPress={() => {
                 if (item.isGroupChat && isGroupAdmin(item)) {
                   Alert.alert(
                     'Opțiuni grup',
                     'Ce dorești să faci cu acest grup?',
                     [
                       { text: 'Anulare', style: 'cancel' },
                       { 
                         text: 'Șterge grup', 
                         style: 'destructive',
                         onPress: () => {
                           Alert.alert(
                             'Confirmare',
                             'Ești sigur că vrei să ștergi acest grup? Această acțiune nu poate fi anulată.',
                             [
                               { text: 'Anulare', style: 'cancel' },
                               { text: 'Șterge', style: 'destructive', onPress: () => deleteGroup(item._id) }
                             ]
                           )
                         }
                       }
                     ]
                   );
                 }
               }}
             >
               <View style={[styles.avatar, { backgroundColor: item.isGroupChat ? colors.primary : colors.success }]}>
                 <Text style={styles.avatarText}>{getChatAvatar(item)}</Text>
               </View>
               
               <View style={styles.chatInfo}>
                 <View style={styles.chatHeader}>
                   <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                     {getChatDisplayName(item)}
                   </Text>
                   {item.latestMessage && (
                     <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                       {formatDate(item.latestMessage.createdAt)}
                     </Text>
                   )}
                 </View>
                 
                 <View style={styles.chatFooter}>
                   <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                     {item.latestMessage ? (
                       <>
                         {item.isGroupChat && item.latestMessage.sender._id !== user._id && (
                           <Text style={{ fontWeight: 'bold' }}>{item.latestMessage.sender.name}: </Text>
                         )}
                         {item.latestMessage.deletedForAll ? (
                           'Acest mesaj a fost șters'
                         ) : item.latestMessage.attachment ? (
                           `${item.latestMessage.attachmentType === 'image' ? 'Imagine' : 'Document'}${item.latestMessage.content ? `: ${item.latestMessage.content}` : ''}`
                         ) : (
                           item.latestMessage.content
                         )}
                       </>
                     ) : (
                       'Nu există mesaje'
                     )}
                   </Text>
                   
                   {item.unreadCount > 0 && (
                     <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                       <Text style={styles.unreadText}>{item.unreadCount}</Text>
                     </View>
                   )}
                 </View>
               </View>
             </TouchableOpacity>
           )}
           style={[styles.chatList, { backgroundColor: colors.background }]}
           showsVerticalScrollIndicator={false}
           refreshControl={
             <RefreshControl
               refreshing={refreshing}
               onRefresh={onRefresh}
               colors={[colors.primary]}
               tintColor={colors.primary}
             />
           }
           ListEmptyComponent={
             <View style={styles.emptyChatList}>
               <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
               <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                 Nu există conversații
               </Text>
               <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                 Începe o conversație nouă
               </Text>
               <TouchableOpacity
                 style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                 onPress={() => {
                   fetchAvailableUsers();
                   setShowNewChatModal(true);
                 }}
               >
                 <Ionicons name="add" size={20} color="#fff" />
                 <Text style={styles.emptyActionText}>Conversație nouă</Text>
               </TouchableOpacity>
             </View>
           }
         />
       </View>
     )}
     
     <Modal
       visible={showMessageActions}
       transparent={true}
       animationType="fade"
       onRequestClose={() => setShowMessageActions(false)}
     >
       <TouchableOpacity 
         style={[styles.messageActionsOverlay, { backgroundColor: colors.modalBackground }]}
         activeOpacity={1}
         onPress={() => setShowMessageActions(false)}
       >
         <View style={[styles.messageActionsContainer, { backgroundColor: colors.card }]}>
           <TouchableOpacity
             style={styles.messageAction}
             onPress={() => {
               setReplyTo(selectedMessage);
               setShowMessageActions(false);
             }}
           >
             <Ionicons name="arrow-undo" size={20} color={colors.primary} />
             <Text style={[styles.messageActionText, { color: colors.text }]}>Răspunde</Text>
           </TouchableOpacity>
           
           {selectedMessage?.sender._id === user._id && (
             <TouchableOpacity
               style={styles.messageAction}
               onPress={() => {
                 Alert.alert(
                   'Șterge mesaj',
                   'Doriți să ștergeți acest mesaj pentru toți sau doar pentru dvs.?',
                   [
                     { text: 'Anulează', style: 'cancel' },
                     { 
                       text: 'Pentru mine', 
                       onPress: () => deleteMessage(selectedMessage._id, false)
                     },
                     { 
                       text: 'Pentru toți', 
                       style: 'destructive',
                       onPress: () => deleteMessage(selectedMessage._id, true)
                     }
                   ]
                 );
               }}
             >
               <Ionicons name="trash" size={20} color={colors.error} />
               <Text style={[styles.messageActionText, { color: colors.error }]}>Șterge</Text>
             </TouchableOpacity>
           )}
         </View>
       </TouchableOpacity>
     </Modal>
     
     <Modal
       visible={showNewChatModal}
       transparent={true}
       animationType="slide"
       onRequestClose={() => setShowNewChatModal(false)}
     >
       <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground }]}>
         <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
           <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
             <Text style={[styles.modalTitle, { color: colors.text }]}>Conversație nouă</Text>
             <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
               <Ionicons name="close" size={24} color={colors.text} />
             </TouchableOpacity>
           </View>
           
           <View style={styles.modalBody}>
             <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
               <Ionicons name="search" size={20} color={colors.textSecondary} />
               <TextInput
                 style={[styles.searchInput, { color: colors.text }]}
                 placeholder="Caută un utilizator..."
                 placeholderTextColor={colors.textSecondary}
                 value={userSearchTerm}
                 onChangeText={setUserSearchTerm}
               />
             </View>
             
             <FlatList
               data={filteredAvailableUsers}
               keyExtractor={(item) => item._id}
               renderItem={({ item }) => (
                 <TouchableOpacity
                   style={[styles.userItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
                   onPress={() => createPrivateChat(item._id)}
                 >
                   <View style={[styles.avatar, { backgroundColor: colors.success }]}>
                     <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                   </View>
                   
                   <View style={styles.userInfo}>
                     <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
                     {item.email && (
                       <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                     )}
                   </View>
                 </TouchableOpacity>
               )}
               style={styles.userList}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={
                 <View style={styles.emptyUserList}>
                   <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                     Nu există utilizatori disponibili
                   </Text>
                 </View>
               }
             />
           </View>
           
           <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
             <TouchableOpacity
               style={[styles.modalButton, { backgroundColor: colors.inputBackground }]}
               onPress={() => setShowNewChatModal(false)}
             >
               <Text style={[styles.modalButtonText, { color: colors.text }]}>Anulează</Text>
             </TouchableOpacity>
             
             <TouchableOpacity
               style={[styles.modalButton, { backgroundColor: colors.primary }]}
               onPress={() => {
                 setShowNewChatModal(false);
                 setShowNewGroupModal(true);
               }}
             >
               <Text style={styles.modalButtonText}>Grup nou</Text>
             </TouchableOpacity>
           </View>
         </View>
       </View>
     </Modal>
     
     {loading && (
       <View style={[styles.loadingOverlay, { backgroundColor: colors.modalBackground }]}>
         <ActivityIndicator size="large" color={colors.primary} />
         <Text style={[styles.loadingText, { color: '#fff', marginTop: 10 }]}>
           Se procesează...
         </Text>
       </View>
     )}
   </View>
 );
};

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
 
 chatListContainer: {
   flex: 1,
 },
 listHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   paddingHorizontal: 16,
   paddingTop: Platform.OS === 'ios' ? 50 : 20,
   paddingBottom: 16,
   borderBottomWidth: 1,
 },
 headerTitle: {
   fontSize: 24,
   fontWeight: 'bold',
 },
 headerActions: {
   flexDirection: 'row',
   gap: 8,
 },
 headerButton: {
   width: 40,
   height: 40,
   borderRadius: 20,
   justifyContent: 'center',
   alignItems: 'center',
 },
 searchContainer: {
   paddingHorizontal: 16,
   paddingVertical: 12,
 },
 searchBar: {
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
 chatList: {
   flex: 1,
 },
 chatItem: {
   flexDirection: 'row',
   padding: 16,
   borderBottomWidth: 1,
 },
 avatar: {
   width: 48,
   height: 48,
   borderRadius: 24,
   justifyContent: 'center',
   alignItems: 'center',
   marginRight: 12,
 },
 avatarText: {
   color: '#fff',
   fontSize: 18,
   fontWeight: 'bold',
 },
 chatInfo: {
   flex: 1,
 },
 chatHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 4,
 },
 chatName: {
   fontSize: 16,
   fontWeight: 'bold',
   flex: 1,
 },
 chatTime: {
   fontSize: 12,
 },
 chatFooter: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
 },
 lastMessage: {
   fontSize: 14,
   flex: 1,
 },
 unreadBadge: {
   minWidth: 20,
   height: 20,
   borderRadius: 10,
   justifyContent: 'center',
   alignItems: 'center',
   paddingHorizontal: 6,
 },
 unreadText: {
   color: '#fff',
   fontSize: 12,
   fontWeight: 'bold',
 },
 
 chatContainer: {
   flex: 1,
 },
 chatHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 16,
   paddingTop: Platform.OS === 'ios' ? 50 : 20,
   paddingBottom: 16,
   borderBottomWidth: 1,
 },
 backButton: {
   marginRight: 12,
 },
 headerInfo: {
   flex: 1,
   marginLeft: 12,
 },
 headerSubtitle: {
   fontSize: 12,
   marginTop: 2,
 },
 headerAction: {
   padding: 8,
 },
 
 replyIndicator: {
   paddingHorizontal: 16,
   paddingVertical: 8,
   borderLeftWidth: 4,
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
 },
 replyContent: {
   flexDirection: 'row',
   alignItems: 'center',
   flex: 1,
 },
 replyInfo: {
   marginLeft: 8,
   flex: 1,
 },
 replyToName: {
   fontSize: 12,
   fontWeight: 'bold',
 },
 replyToText: {
   fontSize: 12,
   marginTop: 2,
 },
 
 messagesList: {
   flex: 1,
 },
 messagesContent: {
   paddingHorizontal: 16,
   paddingVertical: 8,
 },
 messagesLoading: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   paddingVertical: 50,
 },
 emptyMessages: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   paddingVertical: 50,
 },
 emptyText: {
   fontSize: 18,
   fontWeight: 'bold',
   marginTop: 16,
   textAlign: 'center',
 },
 emptySubtext: {
   fontSize: 14,
   marginTop: 8,
   textAlign: 'center',
 },
 messageContainer: {
   marginVertical: 4,
 },
 myMessageContainer: {
   alignItems: 'flex-end',
 },
 otherMessageContainer: {
   alignItems: 'flex-start',
 },
 messageBubble: {
   maxWidth: '80%',
   borderRadius: 16,
   paddingHorizontal: 12,
   paddingVertical: 8,
 },
 deletedMessage: {
   opacity: 0.5,
 },
 senderName: {
   fontSize: 12,
   fontWeight: 'bold',
   marginBottom: 4,
 },
 messageText: {
   fontSize: 16,
   lineHeight: 20,
 },
 deletedText: {
   fontStyle: 'italic',
 },
 messageTimeContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'flex-end',
   marginTop: 4,
 },
 messageTime: {
   fontSize: 11,
 },
 replyContainer: {
   borderLeftWidth: 3,
   paddingLeft: 8,
   paddingVertical: 4,
   marginBottom: 6,
   borderRadius: 4,
 },
 replyName: {
   fontSize: 12,
   fontWeight: 'bold',
 },
 replyText: {
   fontSize: 12,
   marginTop: 2,
 },
 
 attachmentContainer: {
   marginTop: 8,
   marginBottom: 4,
 },
 attachmentImage: {
   width: 200,
   height: 150,
   borderRadius: 8,
 },
 documentAttachment: {
   flexDirection: 'row',
   alignItems: 'center',
   padding: 12,
   borderRadius: 8,
   minWidth: 200,
 },
 documentInfo: {
   flex: 1,
   marginLeft: 12,
   marginRight: 12,
 },
 attachmentName: {
   fontSize: 14,
   fontWeight: '500',
 },
 attachmentSize: {
   fontSize: 12,
   marginTop: 2,
 },
 attachmentOptions: {
   flexDirection: 'row',
   paddingHorizontal: 16,
   paddingVertical: 12,
   borderTopWidth: 1,
   justifyContent: 'space-around',
 },
 attachmentOption: {
   alignItems: 'center',
 },
 attachmentIcon: {
   width: 48,
   height: 48,
   borderRadius: 24,
   justifyContent: 'center',
   alignItems: 'center',
   marginBottom: 4,
 },
 attachmentLabel: {
   fontSize: 12,
 },
 
 inputContainer: {
   flexDirection: 'row',
   alignItems: 'flex-end',
   paddingHorizontal: 16,
   paddingVertical: 8,
   paddingBottom: Platform.OS === 'ios' ? 8 : 12,
   borderTopWidth: 1,
   minHeight: 60,
 },
 attachmentButton: {
   marginRight: 8,
   marginBottom: 8,
   padding: 8,
 },
 messageInput: {
   flex: 1,
   borderRadius: 20,
   paddingHorizontal: 16,
   paddingVertical: 8,
   maxHeight: 100,
   marginRight: 8,
   fontSize: 16,
   textAlignVertical: 'center',
 },
 sendButton: {
   width: 40,
   height: 40,
   borderRadius: 20,
   justifyContent: 'center',
   alignItems: 'center',
   marginBottom: 4,
 },
 
 typingIndicator: {
   paddingHorizontal: 16,
   paddingVertical: 8,
 },
 typingText: {
   fontSize: 14,
   fontStyle: 'italic',
 },
 
 emptyChatList: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   paddingVertical: 50,
 },
 emptyActionButton: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 20,
   paddingVertical: 12,
   borderRadius: 8,
   marginTop: 16,
 },
 emptyActionText: {
   color: '#fff',
   fontSize: 16,
   fontWeight: 'bold',
   marginLeft: 8,
 },
 
 modalContainer: {
   flex: 1,
   justifyContent: 'flex-end',
 },
 modalContent: {
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
 },
 modalTitle: {
   fontSize: 20,
   fontWeight: 'bold',
 },
 modalBody: {
   padding: 20,
 },
 modalFooter: {
   flexDirection: 'row',
   padding: 20,
   borderTopWidth: 1,
   gap: 12,
 },
 modalButton: {
   flex: 1,
   paddingVertical: 12,
   borderRadius: 8,
   alignItems: 'center',
 },
 modalButtonText: {
   fontSize: 16,
   fontWeight: 'bold',
   color: '#fff',
 },
 
 userList: {
   maxHeight: 300,
 },
 userItem: {
   flexDirection: 'row',
   alignItems: 'center',
   padding: 12,
   borderBottomWidth: 1,
 },
 userInfo: {
   flex: 1,
   marginLeft: 12,
 },
 userName: {
   fontSize: 16,
   fontWeight: 'bold',
 },
 userEmail: {
   fontSize: 14,
   marginTop: 2,
 },
 emptyUserList: {
   padding: 20,
   alignItems: 'center',
 },
 
 messageActionsOverlay: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
 },
 messageActionsContainer: {
   borderRadius: 12,
   overflow: 'hidden',
   minWidth: 200,
 },
 messageAction: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 20,
   paddingVertical: 16,
 },
 messageActionText: {
   fontSize: 16,
   marginLeft: 12,
 },
 loadingOverlay: {
   position: 'absolute',
   top: 0,
   left: 0,
   right: 0,
   bottom: 0,
   justifyContent: 'center',
   alignItems: 'center',
   zIndex: 1000,
 },
});

export default ChatScreen;