// src/utils/users.js

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'users.json');

let users = [];

if (fs.existsSync(file)) {
  try {
    users = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    users = [];
  }
}

const save = () => fs.writeFileSync(file, JSON.stringify(users, null, 2));

const addUser = (from) => {
  if (!users.find(u => u.id === from.id)) {
    users.push({
      id: from.id,
      first_name: from.first_name || 'NoName',
      username: from.username || null,
      bestScore: 0,
      joinedAt: new Date().toISOString()
    });
    save();
  }
};

const updateBestScore = (userId, score) => {
  const user = users.find(u => u.id === userId);
  if (user && score > user.bestScore) {
    user.bestScore = score;
    save();
  }
};

const getStats = () => ({
  total: users.length,
  users
});

const getLeaderboard = () => {
  return users
    .filter(u => u.bestScore > 0)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 10)
    .map(u => ({
      id: u.id,
      first_name: u.first_name,
      bestScore: u.bestScore
    }));
};

module.exports = { addUser, getStats, updateBestScore, getLeaderboard };