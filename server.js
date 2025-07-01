const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

const users = new Map(); // Store username -> verification code
const games = new Map(); // Store gameId -> game data
let gameCounter = 0;

app.post('/api/get-verification-code', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'Username required.' });

    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/search?term=${username}`);
        if (response.data.data.length === 0) {
            return res.json({ success: false, message: 'Roblox user not found.' });
        }
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        users.set(username, code);
        res.json({ success: true, code });
    } catch (error) {
        res.json({ success: false, message: 'Error contacting Roblox API.' });
    }
});

app.post('/api/verify-user', async (req, res) => {
    const { username, code } = req.body;
    if (!username || !code) return res.json({ success: false, message: 'Username and code required.' });

    const storedCode = users.get(username);
    if (!storedCode || storedCode !== code) {
        return res.json({ success: false, message: 'Invalid code.' });
    }

    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/search?term=${username}`);
        if (response.data.data.length === 0) {
            return res.json({ success: false, message: 'Roblox user not found.' });
        }
        const userId = response.data.data[0].id;
        const profileResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const description = profileResponse.data.description || '';
        if (description.includes(code)) {
            users.delete(username);
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Code not found in Roblox profile description.' });
        }
    } catch (error) {
        res.json({ success: false, message: 'Error contacting Roblox API.' });
    }
});

io.on('connection', (socket) => {
    socket.on('createGame', ({ username, side }) => {
        if (!['flower', 'leaf'].includes(side)) return;
        const gameId = `game-${gameCounter++}`;
        games.set(gameId, { gameId, creator: username, side, status: 'waiting' });
        io.emit('updateGames', Array.from(games.values()).filter(game => game.status === 'waiting'));
    });

    socket.on('joinGame', ({ gameId, username, side }) => {
        const game = games.get(gameId);
        if (!game || game.status !== 'waiting') return;
        if (game.creator === username) return;

        game.status = 'playing';
        const result = Math.random() < 0.5 ? 'flower' : 'leaf';
        const winner = (game.side === result) ? game.creator : (side === result) ? username : 'Tie';
        games.delete(gameId);

        io.emit('flipCoin', { gameId, result, winner });
        io.emit('updateGames', Array.from(games.values()).filter(game => game.status === 'waiting'));
    });

    socket.on('getActiveGames', () => {
        socket.emit('updateGames', Array.from(games.values()).filter(game => game.status === 'waiting'));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
