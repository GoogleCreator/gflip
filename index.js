const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const users = new Map();
const games = new Map();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('signup', ({ username }) => {
    if (!username || username.trim().length === 0) {
      socket.emit('signupError', 'Username cannot be empty');
      return;
    }
    if (users.has(username)) {
      socket.emit('signupError', 'Username already taken');
      return;
    }
    users.set(username, socket.id);
    socket.username = username;
    console.log(`User signed up: ${username}`);
    socket.emit('signupSuccess', {
      username,
      games: Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players }))
    });
  });

  socket.on('createGame', () => {
    if (!socket.username) {
      socket.emit('error', 'Must be signed in to create a game');
      return;
    }
    const gameId = Date.now().toString();
    games.set(gameId, { players: [{ username: socket.username, socketId: socket.id, choice: null }], status: 'waiting', result: null });
    socket.join(gameId);
    console.log(`Game created: ${gameId} by ${socket.username}`);
    io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
    socket.emit('gameJoined', { gameId, players: games.get(gameId).players });
  });

  socket.on('joinGame', ({ gameId }) => {
    if (!socket.username) {
      socket.emit('error', 'Must be signed in to join a game');
      return;
    }
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Game does not exist');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('error', 'Game is full');
      return;
    }
    if (game.status !== 'waiting') {
      socket.emit('error', 'Game is not accepting players');
      return;
    }
    if (game.players.some(p => p.username === socket.username)) {
      socket.emit('error', 'Cannot join your own game');
      return;
    }
    game.players.push({ username: socket.username, socketId: socket.id, choice: null });
    socket.join(gameId);
    console.log(`User ${socket.username} joined game ${gameId}`);
    io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
    io.to(gameId).emit('gameJoined', { gameId, players: game.players });
  });

  socket.on('makeChoice', ({ gameId, choice }) => {
    if (!socket.username || !['heads', 'tails'].includes(choice)) {
      socket.emit('error', 'Invalid choice or not signed in');
      return;
    }
    const game = games.get(gameId);
    if (!game || game.status !== 'waiting') {
      socket.emit('error', 'Game not found or not in progress');
      return;
    }
    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Not a player in this game');
      return;
    }
    player.choice = choice;
    console.log(`Player ${socket.username} chose ${choice} in game ${gameId}`);

    if (game.players.every(p => p.choice)) {
      game.status = 'flipping';
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      game.result = result;
      const winner = game.players.find(p => p.choice === result)?.username || 'Tie';
      console.log(`Game ${gameId} result: ${result}, winner: ${winner}`);
      io.to(gameId).emit('flipResult', { result, winner });
      setTimeout(() => {
        games.delete(gameId);
        io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
        console.log(`Game ${gameId} ended`);
      }, 5000);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      console.log(`User disconnected: ${socket.username}`);
      users.delete(socket.username);
      games.forEach((game, gameId) => {
        game.players = game.players.filter(p => p.socketId !== socket.id);
        if (game.players.length === 0) {
          games.delete(gameId);
          console.log(`Game ${gameId} deleted due to no players`);
        } else {
          io.to(gameId).emit('gameJoined', { gameId, players: game.players });
        }
      });
      io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
