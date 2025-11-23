require('dotenv').config();

module.exports = {
  botToken: process.env.TOKEN,
  timerDuration: 30, // seconds
  passPercentage: 50 // minimum percentage to pass the quiz
};
