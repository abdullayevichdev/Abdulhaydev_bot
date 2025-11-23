const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { getCorrectIndex, cleanupSession } = require('../utils/helpers');
const { startTimer, stopTimer, setOnTimeUp } = require('../utils/timer');

// Load questions
const questionsPath = path.join(__dirname, '../../questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

const startQuiz = (ctx) => {
  ctx.session = {};
  return ctx.reply(
    'Assalomu alaykum! Ingliz tili darajangizni sinab ko\'ring\n\nDarajani tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('A1', 'A1')],
      [Markup.button.callback('A2', 'A2')],
      [Markup.button.callback('B1', 'B1')],
      [Markup.button.callback('B2', 'B2')],
      [Markup.button.callback('C1', 'C1')],
      [Markup.button.callback('C2', 'C2')]
    ])
  );
};

const selectLevel = async (ctx) => {
  const level = ctx.match[0];
  ctx.session = {
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: questions[level].length
  };

  await ctx.editMessageText(
    `Siz ${level} darajasini tanladingiz!\n\n<b>Boshladik!</b>`,
    { parse_mode: 'HTML' }
  );
  await sendQuestion(ctx);
};

const sendQuestion = async (ctx) => {
  try {
    const { level, questionIndex } = ctx.session;
    
    // Check if level exists in questions
    if (!questions[level]) {
      throw new Error(`Level ${level} not found in questions`);
    }
    
    // Check if question exists
    if (questionIndex >= questions[level].length) {
      return showResults(ctx);
    }
    
    const q = questions[level][questionIndex];
    if (!q) {
      return showResults(ctx);
    }

    ctx.session.currentQuestion = q;
    const optionsText = q.options.join('\n');

    // Send question
    await ctx.replyWithHTML(
      `<b>${questionIndex + 1}/${questions[level].length}</b>\n\n${q.question}\n\n${optionsText}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('A', 'ans_A'), Markup.button.callback('B', 'ans_B')],
        [Markup.button.callback('C', 'ans_C'), Markup.button.callback('D', 'ans_D')]
      ])
    );
    
    // Start timer
    const timerMsg = await ctx.reply('⏳ Tayyorlanmoqda...');
    startTimer(ctx, q, timerMsg);
    
  } catch (error) {
    console.error('Xatolik savol yuborishda:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring /start');
    console.error(error.stack);
  }
};

const handleAnswer = async (ctx) => {
  try {
    // Handle next question button
    if (ctx.match[0] === 'next_question') {
      if (ctx.session.waitingForNext) {
        delete ctx.session.waitingForNext;
        if (ctx.session.autoNextTimeout) {
          clearTimeout(ctx.session.autoNextTimeout);
          delete ctx.session.autoNextTimeout;
        }
        return proceedToNextQuestion(ctx);
      }
      return ctx.answerCbQuery();
    }

    // Stop any running timers
    if (ctx.session.timer) {
      stopTimer(ctx);
    }

    // Get user's answer
    const userAnswer = ctx.match[0].split('_')[1];
    const q = ctx.session.currentQuestion;
    
    // Check if question exists
    if (!q) {
      return await ctx.reply('Savol topilmadi. Iltimos, qaytadan boshlang /start');
    }

    // Check if answer is correct
    const correctIdx = getCorrectIndex(q);
    const correctLetter = ['A', 'B', 'C', 'D'][correctIdx];
    const isCorrect = userAnswer === correctLetter;

    // Update score if correct
    if (isCorrect) {
      ctx.session.correctAnswers = (ctx.session.correctAnswers || 0) + 1;
    }

    // Show feedback and correct answer
    await ctx.answerCbQuery(); // Acknowledge the button press immediately
    
    // Show if answer was correct or not
    const resultEmoji = isCorrect ? '✅' : '❌';
    const resultText = isCorrect ? 'To\'g\'ri!' : `Noto'g'ri!`;
    
    await ctx.editMessageText(
      `${resultEmoji} ${resultText}\n\n${q.question}\n\n✅ To'g'ri javob: <b>${correctLetter}. ${q.options[correctIdx]}</b>`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Keyingi savol', callback_data: 'next_question' }]
          ]
        }
      }
    );
    
    // Set a timeout to auto-proceed after 3 seconds
    ctx.session.waitingForNext = true;
    ctx.session.autoNextTimeout = setTimeout(() => {
      if (ctx.session.waitingForNext) {
        proceedToNextQuestion(ctx);
      }
    }, 3000);
    
  } catch (error) {
    console.error('Javobni qayta ishlashda xatolik:', error);
    await ctx.answerCbQuery('Xatolik yuz berdi. Iltimos, qaytadan urining.');
    console.error(error.stack);
  }
};

async function proceedToNextQuestion(ctx) {
  try {
    if (ctx.session.autoNextTimeout) {
      clearTimeout(ctx.session.autoNextTimeout);
      delete ctx.session.autoNextTimeout;
    }
    
    delete ctx.session.waitingForNext;
    
    if (!ctx.session) {
      return await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
    }
    
    // Move to next question
    ctx.session.questionIndex = (ctx.session.questionIndex || 0) + 1;
    
    // Check if there are more questions
    const { level, questionIndex } = ctx.session;
    if (questionIndex >= questions[level].length) {
      return await showResults(ctx);
    }
    
    // Send next question
    await sendQuestion(ctx);
    
  } catch (error) {
    console.error('Keyingi savolga o\'tishda xatolik:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
  }
}

const nextQuestion = async (ctx) => {
  try {
    const { level, questionIndex } = ctx.session;
    
    // Check if there are more questions
    if (questionIndex >= questions[level].length) {
      return await showResults(ctx);
    }
    
    // Send next question
    await sendQuestion(ctx);
    
  } catch (error) {
    console.error('Keyingi savolga o\'tishda xatolik:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
    console.error(error.stack);
  }
};

const showResults = (ctx) => {
  const { correctAnswers, totalQuestions, level } = ctx.session;
  const percent = Math.round((correctAnswers / totalQuestions) * 100);

  let comment = '';
  if (percent >= 90) comment = 'Ajoyib!';
  else if (percent >= 70) comment = 'Juda yaxshi!';
  else if (percent >= 50) comment = 'Yaxshi!';
  else comment = 'Yana mashq qiling!';

  ctx.replyWithHTML(`
${comment} <b>Test yakunlandi!</b> ${comment}

Daraja: <b>${level}</b>
To'g'ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>
Foiz: <b>${percent}%</b>

Yana boshlash uchun /start bosing!
  `).catch(error => {
    console.error('Error showing results:', error);
  });

  // Clean up session
  cleanupSession(ctx);
};

// Set up the onTimeUp callback for the timer
setOnTimeUp(proceedToNextQuestion);

module.exports = {
  startQuiz,
  selectLevel,
  handleAnswer,
  sendQuestion,
  nextQuestion,
  proceedToNextQuestion
};
