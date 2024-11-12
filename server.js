const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

// Store room state
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join room
  socket.on('joinRoom', ({ roomId, isAdmin }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        currentPage: 1,
        adminSocket: isAdmin ? socket.id : null,
        viewers: new Set()
      });
    }
    
    const room = rooms.get(roomId);
    room.viewers.add(socket.id);
    
    // Send current state to new user
    socket.emit('pageSync', { page: room.currentPage });
    
    // Broadcast viewer count
    io.to(roomId).emit('viewerCount', { count: room.viewers.size });
  });
  
  // Handle page changes
  socket.on('pageChange', ({ roomId, page }) => {
    const room = rooms.get(roomId);
    if (room && (room.adminSocket === socket.id || !room.adminSocket)) {
      room.currentPage = page;
      socket.to(roomId).emit('pageSync', { page });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        if (room.adminSocket === socket.id) {
          room.adminSocket = null;
        }
        io.to(roomId).emit('viewerCount', { count: room.viewers.size });
        
        // Clean up empty rooms
        if (room.viewers.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});