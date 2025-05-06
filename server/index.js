require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Socket.io setup with ping timeout increased for better connection stability
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Allow long-polling to fall back if websockets don't work
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,        // Longer ping timeout
  pingInterval: 25000,       // More frequent pings
  upgradeTimeout: 30000,     // Longer upgrade timeout
  maxHttpBufferSize: 1e8,    // 100MB max buffer size for larger video packets
  allowUpgrades: true,       // Allow transport upgrades
  connectTimeout: 30000      // Increase connection timeout
});

// Store active rooms
const activeRooms = {};

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room with improved session management
  socket.on('join-room', ({ roomId, userId, username }) => {
    console.log(`User ${username} (${userId}) joined room: ${roomId}`);
    
    // Store user info in socket session for easier access
    socket.data = {
      userId,
      username,
      roomId
    };
    
    // Create room if it doesn't exist
    if (!activeRooms[roomId]) {
      activeRooms[roomId] = { 
        participants: [],
        messages: [],
        created: Date.now()
      };
    } else {
      // Clean up any existing instances of this user (in case of reconnect)
      activeRooms[roomId].participants = activeRooms[roomId].participants.filter(
        p => p.userId !== userId
      );
    }
    
    // Add user to room with additional tracking info
    activeRooms[roomId].participants.push({
      userId,
      username,
      socketId: socket.id,
      joinedAt: Date.now()
    });
    
    // Join the room
    socket.join(roomId);
    
    console.log(`Room ${roomId} now has ${activeRooms[roomId].participants.length} participants`);
    
    // Notify others in the room
    socket.to(roomId).emit('user-connected', { userId, username });
    
    // Send list of all participants to the newly joined user
    socket.emit('room-participants', activeRooms[roomId].participants);
    
    // Send the message history to the new user
    if (activeRooms[roomId].messages && activeRooms[roomId].messages.length > 0) {
      socket.emit('message-history', { messages: activeRooms[roomId].messages });
    }
    
    // Handle user disconnecting
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      if (activeRooms[roomId]) {
        // Remove user from room participants
        activeRooms[roomId].participants = activeRooms[roomId].participants.filter(
          participant => participant.socketId !== socket.id
        );
        
        // Notify others that user has left
        socket.to(roomId).emit('user-disconnected', { userId, username });
        
        // Remove room if empty
        if (activeRooms[roomId].participants.length === 0) {
          delete activeRooms[roomId];
        }
      }
    });
  });

  // Handle WebRTC signaling
  socket.on('signal', ({ roomId, to, from, signal }) => {
    console.log(`Signal from ${from} to ${to} in room ${roomId}. Type: ${signal.type}`);
    
    // First try to find the recipient's socket ID if we only have user ID
    let targetSocketId = to;
    if (activeRooms[roomId]) {
      const participant = activeRooms[roomId].participants.find(p => p.userId === to);
      if (participant) {
        targetSocketId = participant.socketId;
      }
    }
    
    // Try directed signal first
    if (targetSocketId) {
      console.log(`Emitting direct signal to socket ${targetSocketId}`);
      io.to(targetSocketId).emit('signal', { from, signal });
    }
    
    // Also broadcast to the room as a fallback strategy
    // This is especially helpful if the socket ID mapping is incorrect
    console.log(`Broadcasting signal to room ${roomId} from ${from}`);
    socket.to(roomId).emit('signal-broadcast', { from, signal });
  });
  
  // Handle ICE candidates with improved routing
  socket.on('ice-candidate', ({ roomId, to, candidate }) => {
    console.log(`ICE candidate from ${socket.id} to ${to} in room ${roomId}`);
    
    // First try to find the recipient's socket ID if we only have user ID
    let targetSocketId = to;
    if (activeRooms[roomId]) {
      const participant = activeRooms[roomId].participants.find(p => p.userId === to);
      if (participant) {
        targetSocketId = participant.socketId;
      }
    }
    
    // Try directed ice candidate first
    if (targetSocketId) {
      console.log(`Emitting direct ICE candidate to socket ${targetSocketId}`);
      io.to(targetSocketId).emit('ice-candidate', { from: socket.id, candidate });
    }
    
    // Also broadcast to the room as a fallback strategy
    console.log(`Broadcasting ICE candidate to room ${roomId}`);
    socket.to(roomId).emit('ice-candidate-broadcast', { from: socket.id, candidate });
  });
  
  // Handle connection testing
  socket.on('ping-user', ({ roomId, to }) => {
    console.log(`Ping from ${socket.id} to ${to} in room ${roomId}`);
    io.to(to).emit('user-ping', { from: socket.id });
  });
  
  socket.on('pong-user', ({ roomId, to }) => {
    console.log(`Pong from ${socket.id} to ${to} in room ${roomId}`);
    io.to(to).emit('user-pong', { from: socket.id });
  });

  // Handle chat messages
  socket.on('send-message', ({ roomId, message, sender, messageId }) => {
    console.log(`Chat message in room ${roomId} from ${sender}: ${message.substring(0, 20)}${message.length > 20 ? '...' : ''}`);
    
    // Generate a timestamp
    const timestamp = Date.now();
    
        // Send to all clients in the room, including sender for confirmation
    io.in(roomId).emit('new-message', { message, sender, timestamp, messageId });
    console.log(`Broadcast message to all ${activeRooms[roomId]?.participants.length || 0} users in room ${roomId}`);
    
    // Store message in room history for late joiners
    if (!activeRooms[roomId].messages) {
      activeRooms[roomId].messages = [];
    }
    
    // Keep only last 100 messages
    if (activeRooms[roomId].messages.length >= 100) {
      activeRooms[roomId].messages.shift();
    }
    
    activeRooms[roomId].messages.push({ message, sender, timestamp, messageId });
  });
  
  // Send message history to newly joined users
  socket.on('get-message-history', ({ roomId }) => {
    console.log(`Message history requested for room ${roomId}`);
    if (activeRooms[roomId] && activeRooms[roomId].messages) {
      socket.emit('message-history', { messages: activeRooms[roomId].messages });
    } else {
      socket.emit('message-history', { messages: [] });
    }
  });
});

// API routes
app.get('/api/create-room', (req, res) => {
  const roomId = uuidv4();
  console.log(`Created new room: ${roomId}`);
  return res.json({ roomId });
});

app.get('/api/check-room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const roomExists = activeRooms[roomId] !== undefined;
  return res.json({ exists: roomExists, usersCount: roomExists ? activeRooms[roomId].participants.length : 0 });
});

// Connection diagnostics endpoint
app.get('/api/network-test', (req, res) => {
  return res.json({ success: true, timestamp: Date.now() });
});

// Room statistics endpoint
app.get('/api/room-stats', (req, res) => {
  const stats = {
    activeRoomsCount: Object.keys(activeRooms).length,
    totalParticipants: Object.values(activeRooms).reduce((acc, room) => acc + room.participants.length, 0),
    rooms: Object.keys(activeRooms).map(id => ({
      id,
      participants: activeRooms[id].participants.length,
      created: activeRooms[id].created
    }))
  };
  return res.json(stats);
});

// Do not serve frontend assets — handled by Vercel separately

const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
