const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state
const users = new Map(); // username -> socket.id
const games = new Map(); // gameId -> { players: [{ username, socketId, choice }], status, result }

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle user sign-up
  socket.on('signup', ({ username }) => {
    if (!username || users.has(username)) {
      socket.emit('signupError', 'Username taken or invalid');
      return;
    }
    users.set(username, socket.id);
    socket.username = username;
    socket.emit('signupSuccess', { username, games: Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })) });
  });

  // Create a new game
  socket.on('createGame', () => {
    if (!socket.username) return;
    const gameId = Date.now().toString();
    games.set(gameId, { players: [{ username: socket.username, socketId: socket.id, choice: null }], status: 'waiting', result: null });
    socket.join(gameId);
    io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
    socket.emit('gameJoined', { gameId, players: games.get(gameId).players });
  });

  // Join an existing game
  socket.on('joinGame', ({ gameId }) => {
    if (!socket.username) return;
    const game = games.get(gameId);
    if (!game || game.players.length >= 2 || game.status !== 'waiting') {
      socket.emit('error', 'Cannot join game');
      return;
    }
    game.players.push({ username: socket.username, socketId: socket.id, choice: null });
    socket.join(gameId);
    io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
    io.to(gameId).emit('gameJoined', { gameId, players: game.players });
  });

  // Handle coinflip choice
  socket.on('makeChoice', ({ gameId, choice }) => {
    if (!socket.username || !['heads', 'tails'].includes(choice)) return;
    const game = games.get(gameId);
    if (!game || game.status !== 'waiting') return;
    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) return;
    player.choice = choice;

    // Check if both players have made choices
    if (game.players.every(p => p.choice)) {
      game.status = 'flipping';
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      game.result = result;
      const winner = game.players.find(p => p.choice === result)?.username || 'Tie';
      io.to(gameId).emit('flipResult', { result, winner });
      setTimeout(() => {
        games.delete(gameId);
        io.emit('updateGames', Array.from(games.entries()).map(([id, game]) => ({ id, players: game.players })));
      }, 5000);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.username);
      games.forEach((game, gameId) => {
        game.players = game.players.filter(p => p.socketId !== socket.id);
        if (game.players.length === 0) {
          games.delete(gameId);
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
