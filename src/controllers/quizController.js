const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { getCorrectIndex } = require('../utils/helpers');
const { startTimer, stopTimer, setOnTimeUp, getTimerText } = require('../utils/timer');

// Savollar faylini yuklash
const questionsPath = path.join(__dirname, '../../questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// Test boshlash
const startQuiz = (ctx) => {
  ctx.session = {}; // Tozalash
  return ctx.reply(
    'Assalomu alaykum! Ingliz tili darajangizni aniqlaymiz\n\nDarajani tanlang:',
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

// Daraja tanlandi
const selectLevel = async (ctx) => {
  const level = ctx.match[0];

  ctx.session = {
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: questions[level].length,
    isPaused: false
  };

  await ctx.editMessageText(`Siz <b>${level}</b> darajasini tanladingiz!\n\nBoshladik!`, {
    parse_mode: 'HTML'
  });

  await sendQuestion(ctx);
};

// Savol yuborish
const sendQuestion = async (ctx) => {
  try {
    // Eski timer va timeoutlarni tozalash
    if (ctx.session.autoNextTimeout) {
      clearTimeout(ctx.session.autoNextTimeout);
      delete ctx.session.autoNextTimeout;
    }
    if (ctx.session.timer) stopTimer(ctx);
    if (ctx.session.timerMessageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.timerMessageId);
      } catch (e) {}
      delete ctx.session.timerMessageId;
    }

    const { level, questionIndex, totalQuestions } = ctx.session;

    if (!questions[level] || questionIndex >= questions[level].length) {
      return showResults(ctx);
    }

    const q = questions[level][questionIndex];
    ctx.session.currentQuestion = q;

    const optionsText = q.options
      .map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`)
      .join('\n');

    const keyboard = [
      [
        Markup.button.callback('A', 'ans_A'),
        Markup.button.callback('B', 'ans_B')
      ],
      [
        Markup.button.callback('C', 'ans_C'),
        Markup.button.callback('D', 'ans_D')
      ],
      [Markup.button.callback('Pauza', 'pause_quiz')]
    ];

    const questionText = `<b>Savol ${questionIndex + 1}/${totalQuestions}</b>\n\n${q.question}\n\n${optionsText}`;

    const sent = await ctx.replyWithHTML(questionText, Markup.inlineKeyboard(keyboard));
    ctx.session.questionMessageId = sent.message_id;

    // Timer: 30 soniya
    const timerMsg = await ctx.reply(getTimerText(30));
    ctx.session.timerMessageId = timerMsg.message_id;

    startTimer(ctx, q, timerMsg);

  } catch (error) {
        console.error('sendQuestion xatosi:', error);
        await ctx.reply('Savol yuborishda xatolik yuz berdi. /start buyrug‘ini bosing.');
    }
};

// Javobni qayta ishlash
const handleAnswer = async (ctx) => {
  try {
    const action = ctx.match[0];

    // Pauza bosildi
    if (action === 'pause_quiz') {
      if (ctx.session.timer) stopTimer(ctx);
      ctx.session.isPaused = true;

      await ctx.answerCbQuery('Test to‘xtatildi');

      return ctx.editMessageReplyMarkup({
        inline_keyboard: [[{ text: 'Qayta boshlash', callback_data: 'restart_quiz' }]]
      });
    }

    // Qayta boshlash
    if (action === 'restart_quiz') {
      ctx.session.questionIndex = 0;
      ctx.session.correctAnswers = 0;
      ctx.session.isPaused = false;

      await ctx.answerCbQuery('Test qayta boshlandi!');
      return sendQuestion(ctx);
    }

    // Keyingi savol
    if (action === 'next_question') {
      if (ctx.session.waitingForNext) {
        delete ctx.session.waitingForNext;
        if (ctx.session.autoNextTimeout) {
          clearTimeout(ctx.session.autoNextTimeout);
          delete ctx.session.autoNextTimeout;
        }
        return proceedToNextQuestion(ctx);
      }
      return;
    }

    // Oddiy javob (A, B, C, D)
    if (ctx.session.timer) stopTimer(ctx);

    const userLetter = action.split('_')[1]; // A, B, C, D
    const q = ctx.session.currentQuestion;

    if (!q) return;

    const correctIdx = getCorrectIndex(q);
    const correctLetter = ['A', 'B', 'C', 'D'][correctIdx];
    const isCorrect = userLetter === correctLetter;

    if (isCorrect) {
      ctx.session.correctAnswers += 1;
    }

    await ctx.answerCbQuery();

    const resultText = isCorrect
      ? 'To‘g‘ri javob!'
      : `Noto‘g‘ri! To‘g‘ri javob: <b>${correctLetter}. ${q.options[correctIdx]}</b>`;

    await ctx.editMessageText(
      `${isCorrect ? 'To‘g‘ri!' : 'Noto‘g‘ri!'}\n\n${q.question}\n\n${resultText}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Keyingi savol', callback_data: 'next_question' }]]
        }
      }
    );

    // 3 soniyadan keyin avto-keyingi savol
    ctx.session.waitingForNext = true;
    ctx.session.autoNextTimeout = setTimeout(() => {
      if (ctx.session.waitingForNext) {
        proceedToNextQuestion(ctx);
      }
    }, 3000);

  } catch (error) {
    console.error('handleAnswer xatosi:', error);
  }
};

// Keyingi savolga o‘tish
const proceedToNextQuestion = async (ctx) => {
  try {
    if (ctx.session.isPaused) return;

    if (ctx.session.autoNextTimeout) {
      clearTimeout(ctx.session.autoNextTimeout);
      delete ctx.session.autoNextTimeout;
    }
    delete ctx.session.waitingForNext;

    ctx.session.questionIndex += 1;

    if (ctx.session.questionIndex >= ctx.session.totalQuestions) {
      return showResults(ctx);
    }

    await sendQuestion(ctx);
  } catch (error) {
    console.error('proceedToNextQuestion xatosi:', error);
  }
};

// Natijalarni ko‘rsatish
const showResults = async (ctx) => {
  try {
    stopTimer(ctx);

    const { correctAnswers, totalQuestions, level } = ctx.session;
    const percent = Math.round((correctAnswers / totalQuestions) * 100);

    let comment = '';
    if (percent >= 90) comment = 'Ajoyib natija! Siz haqiqiy professional!';
    else if (percent >= 75) comment = 'Juda yaxshi! Zo‘r!';
    else if (percent >= 60) comment = 'Yaxshi natija!';
    else if (percent >= 40) comment = 'O‘rtacha. Yana mashq qiling!';
    else comment = 'Yana o‘qish kerak. Hechqisi yo‘q, davom eting!';

    await ctx.replyWithHTML(
      `Test yakunlandi!\n\n` +
      `Daraja: <b>${level}</b>\n` +
      `To‘g‘ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>\n` +
      `Foiz: <b>${percent}%</b>\n\n` +
      `${comment}\n\n` +
      `Yana sinab ko‘rish uchun /start bosing!`
    );

    // Session tozalash
    ctx.session = {};
  } catch (error) {
    console.error('showResults xatosi:', error);
  }
};

// Timer tugaganda avtomatik keyingi savolga o‘tish
setOnTimeUp(proceedToNextQuestion);

module.exports = {
  startQuiz,
  selectLevel,
  handleAnswer,
  sendQuestion,
  proceedToNextQuestion,
  showResults
};