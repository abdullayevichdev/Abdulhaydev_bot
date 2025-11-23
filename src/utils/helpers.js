const { getTimerText } = require('./timer');

/**
 * Get the index of the correct answer
 * @param {Object} question - The question object
 * @returns {number} Index of the correct answer
 */
const getCorrectIndex = (question) => {
  if (question.answer) {
    return ['A', 'B', 'C', 'D'].indexOf(question.answer.toUpperCase());
  }
  if (typeof question.correct === 'number') {
    return question.correct;
  }
  if (typeof question.correct === 'string') {
    return ['A', 'B', 'C', 'D'].indexOf(question.correct.toUpperCase());
  }
  return 0;
};

/**
 * Clean up the session
 * @param {Object} ctx - Telegraf context
 */
const cleanupSession = (ctx) => {
  if (ctx.session.timerInterval) clearInterval(ctx.session.timerInterval);
  if (ctx.session.timeout) clearTimeout(ctx.session.timeout);
  
  // Reset session
  ctx.session = {};
};

/**
 * Move to the next question
 * @param {Object} ctx - Telegraf context
 */
const nextQuestion = (ctx) => {
  ctx.session.questionIndex++;
  // Import here to avoid circular dependency
  const { sendQuestion } = require('../controllers/quizController');
  sendQuestion(ctx);
};

module.exports = {
  getCorrectIndex,
  cleanupSession,
  nextQuestion,
  getTimerText
};
