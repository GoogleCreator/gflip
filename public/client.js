const socket = io();
let username = null;

// DOM elements
const signupModal = document.getElementById('signupModal');
const usernameInput = document.getElementById('usernameInput');
const signupButton = document.getElementById('signupButton');
const signupError = document.getElementById('signupError');
const gameContainer = document.getElementById('gameContainer');
const currentUser = document.getElementById('currentUser');
const createGameButton = document.getElementById('createGameButton');
const gamesList = document.getElementById('games');
const gameArea = document.getElementById('gameArea');
const gameIdSpan = document.getElementById('gameId');
const playersSpan = document.getElementById('players');
const choiceArea = document.getElementById('choiceArea');
const resultArea = document.getElementById('resultArea');
const coin = document.getElementById('coin');
const resultText = document.getElementById('resultText');

// Sign-up handling
signupButton.addEventListener('click', () => {
  const inputUsername = usernameInput.value.trim();
  if (inputUsername) {
    socket.emit('signup', { username: inputUsername });
  }
});

socket.on('signupSuccess', ({ username: signedUsername, games }) => {
  username = signedUsername;
  signupModal.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  currentUser.textContent = username;
  updateGameList(games);
});

socket.on('signupError', (message) => {
  signupError.textContent = message;
});

// Game list handling
createGameButton.addEventListener('click', () => {
  socket.emit('createGame');
});

socket.on('updateGames', (games) => {
  updateGameList(games);
});

function updateGameList(games) {
  gamesList.innerHTML = '';
  games.forEach(([id, game]) => {
    if (game.players.length < 2) {
      const li = document.createElement('li');
      li.textContent = `Game ${id} (${game.players.map(p => p.username).join(', ')})`;
      li.addEventListener('click', () => socket.emit('joinGame', { gameId: id }));
      gamesList.appendChild(li);
    }
  });
}

// Game area handling
socket.on('gameJoined', ({ gameId, players }) => {
  gameArea.classList.remove('hidden');
  gameIdSpan.textContent = gameId;
  playersSpan.textContent = players.map(p => p.username).join(', ');
  choiceArea.classList.remove('hidden');
  resultArea.classList.add('hidden');
  coin.classList.remove('heads', 'tails', 'flip-animation');
  resultText.textContent = '';
});

document.getElementById('headsButton').addEventListener('click', () => {
  socket.emit('makeChoice', { gameId: gameIdSpan.textContent, choice: 'heads' });
  choiceArea.classList.add('hidden');
});

document.getElementById('tailsButton').addEventListener('click', () => {
  socket.emit('makeChoice', { gameId: gameIdSpan.textContent, choice: 'tails' });
  choiceArea.classList.add('hidden');
});

socket.on('flipResult', ({ result, winner }) => {
  resultArea.classList.remove('hidden');
  coin.classList.add(result, 'flip-animation');
  resultText.textContent = winner === username ? 'You win!' : winner === 'Tie' ? 'It\'s a tie!' : `${winner} wins!`;
});

socket.on('error', (message) => {
  alert(message);
});
