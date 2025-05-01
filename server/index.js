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

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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
      activeRooms[roomId] = { participants: [] };
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
    console.log(`Signal from ${from} to ${to}`);
    io.to(to).emit('signal', { from, signal });
  });
  
  // Handle ICE candidates
  socket.on('ice-candidate', ({ roomId, to, candidate }) => {
    console.log(`ICE candidate for room ${roomId}`);
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Handle chat messages
  socket.on('send-message', ({ roomId, message, sender }) => {
    io.to(roomId).emit('new-message', { message, sender });
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
  return res.json({ exists: roomExists });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
