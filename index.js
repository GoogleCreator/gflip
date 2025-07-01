const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const words = ['apple', 'blue', 'cloud', 'dream', 'earth', 'fire', 'green', 'heart', 'light', 'moon', 'ocean', 'star', 'tree', 'wind', 'sky'];
let currentWord = words[Math.floor(Math.random() * words.length)];

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection
io.on('connection', (socket) => {
  // Send current word to new client
  socket.emit('word', currentWord);

  // Handle client disconnection (optional logging)
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Broadcast new word every 5 seconds
setInterval(() => {
  currentWord = words[Math.floor(Math.random() * words.length)];
  io.emit('word', currentWord);
}, 5000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
