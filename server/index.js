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
  transports: ['websocket', 'polling']
});

// Store active rooms
const activeRooms = {};

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join room
  socket.on('join-room', ({ roomId, userId, username }) => {
    console.log(`User ${username} (${userId}) joined room: ${roomId}`);
    
    // Create room if it doesn't exist
    if (!activeRooms[roomId]) {
      activeRooms[roomId] = { 
        participants: [],
        messages: [],
        created: Date.now()
      };
    }
    
    // Add user to room
    activeRooms[roomId].participants.push({
      userId,
      username,
      socketId: socket.id
    });
    
    // Join the room
    socket.join(roomId);
    
    // Notify others in the room
    socket.to(roomId).emit('user-connected', { userId, username });
    
    // Send list of all participants to the newly joined user
    socket.emit('room-participants', activeRooms[roomId].participants);
    
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
    console.log(`Signal from ${from} to ${to} in room ${roomId}`);
    // Try both direct socket ID and room-based routing
    if (to) {
      io.to(to).emit('signal', { from, signal });
    }
    
    // Also broadcast to the room except the sender as a backup strategy
    socket.to(roomId).emit('signal-broadcast', { from, signal });
  });
  
  // Handle ICE candidates
  socket.on('ice-candidate', ({ roomId, to, candidate }) => {
    console.log(`ICE candidate from ${socket.id} to ${to} in room ${roomId}`);
    // Try both direct socket ID and room-based routing
    if (to) {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    }
    
    // Also broadcast to the room except the sender as a backup strategy
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
