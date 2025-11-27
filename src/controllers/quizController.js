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
  ctx.session = {};
  return ctx.reply(
    '🇺🇿 Assalomu alaykum! Ingliz tili darajangizni aniqlaymiz\n\n📊 Darajani tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🟢 A1', 'A1')],
      [Markup.button.callback('🔵 A2', 'A2')],
      [Markup.button.callback('🟡 B1', 'B1')],
      [Markup.button.callback('🟠 B2', 'B2')],
      [Markup.button.callback('🔴 C1', 'C1')],
      [Markup.button.callback('🟣 C2', 'C2')]
    ])
  );
};

// Daraja tanlandi
const selectLevel = async (ctx) => {
  await ctx.answerCbQuery();
  const level = ctx.callbackQuery.data;

  ctx.session = {
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: questions[level].length,
    isPaused: false
  };

  await ctx.editMessageText(`🎯 Siz <b>${level}</b> darajasini tanladingiz!\n\n🚀 Boshladik!`, {
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
      [Markup.button.callback('⏸️ Pauza', 'pause_quiz')]
    ];

    const questionText = `📝 <b>Savol ${questionIndex + 1}/${totalQuestions}</b>\n\n${q.question}\n\n${optionsText}`;

    const sent = await ctx.replyWithHTML(questionText, Markup.inlineKeyboard(keyboard));
    ctx.session.questionMessageId = sent.message_id;

    // Timer: 10 seconds
    const timerDuration = 10;
    const timerMsg = await ctx.reply(getTimerText(timerDuration, timerDuration), { 
      parse_mode: 'HTML' 
    });
    ctx.session.timerMessageId = timerMsg.message_id;

    // Set the timeout callback
    setOnTimeUp(async () => {
      if (ctx.session.timerMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.timerMessageId);
        } catch (e) {}
        delete ctx.session.timerMessageId;
      }

      if (ctx.session.questionMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.questionMessageId);
        } catch (e) {}
        delete ctx.session.questionMessageId;
      }

      await proceedToNextQuestion(ctx);
    });

    // Start the timer
    startTimer(ctx, q, timerMsg, timerDuration);

  } catch (error) {
    console.error('sendQuestion xatosi:', error);
    await ctx.reply('❌ Savol yuborishda xatolik yuz berdi. /start buyrugʻini bosing.');
  }
};

// Javobni qayta ishlash
const handleAnswer = async (ctx) => {
  try {
    // Avval callback query ni javoblaymiz (loading ni yo'qotish uchun)
    await ctx.answerCbQuery();
    
    const action = ctx.callbackQuery.data;

    // Pauza bosildi
    if (action === 'pause_quiz') {
      if (ctx.session.timer) stopTimer(ctx);
      ctx.session.isPaused = true;

      await ctx.editMessageReplyMarkup({
        inline_keyboard: [[{ text: '🔄 Qayta boshlash', callback_data: 'restart_quiz' }]]
      });
      return;
    }

    // Qayta boshlash
    if (action === 'restart_quiz') {
      ctx.session.questionIndex = 0;
      ctx.session.correctAnswers = 0;
      ctx.session.isPaused = false;
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

    // Oddiy javob (ans_A, ans_B, ans_C, ans_D)
    if (action.startsWith('ans_')) {
      if (ctx.session.timer) stopTimer(ctx);

      const userLetter = action.split('_')[1];
      const q = ctx.session.currentQuestion;

      if (!q) return;

      const correctIdx = getCorrectIndex(q);
      const correctLetter = ['A', 'B', 'C', 'D'][correctIdx];
      const isCorrect = userLetter === correctLetter;

      if (isCorrect) {
        ctx.session.correctAnswers += 1;
      }

      // Delete timer message if exists
      if (ctx.session.timerMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.timerMessageId);
        } catch (e) {}
        delete ctx.session.timerMessageId;
      }

      // JAVOB XABARI - ALOHIDA XABAR KO'RINISHIDA
      let resultMessage = '';
      
      if (isCorrect) {
        resultMessage = 
          `✅ <b>TO'G'RI JAVOB!</b>\n\n` +
          `👤 Siz tanladingiz: <b>${userLetter}. ${q.options[userLetter.charCodeAt(0) - 65]}</b>\n` +
          `🎉 Ajoyib! Bu to'g'ri javob!\n\n` +
          `📚 <i>"${q.explanation || "Tushuntirish mavjud emas"}"</i>`;
      } else {
        resultMessage = 
          `❌ <b>NOTO'G'RI JAVOB!</b>\n\n` +
          `👤 Siz tanladingiz: <b>${userLetter}. ${q.options[userLetter.charCodeAt(0) - 65]}</b>\n` +
          `✅ To'g'ri javob: <b>${correctLetter}. ${q.options[correctIdx]}</b>\n\n` +
          `💡 Tushuntirish: <i>${q.explanation || "Tushuntirish mavjud emas"}</i>`;
      }

      // Alohida xabar sifatida javobni yuborish
      await ctx.replyWithHTML(resultMessage, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '⏭️ Keyingi savol',
              callback_data: 'next_question'
            }
          ]]
        }
      });

      // Eski savol xabarini o'chirish
      if (ctx.session.questionMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.questionMessageId);
        } catch (e) {}
        delete ctx.session.questionMessageId;
      }

      // Auto-proceed to next question after 3 seconds
      ctx.session.waitingForNext = true;
      ctx.session.autoNextTimeout = setTimeout(() => {
        if (ctx.session.waitingForNext) {
          proceedToNextQuestion(ctx);
        }
      }, 3000);
    }

  } catch (error) {
    console.error('handleAnswer xatosi:', error);
    await ctx.reply('❌ Javobni qayta ishlashda xatolik yuz berdi.');
  }
};

// Keyingi savolga o'tish
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
      await showResults(ctx);
    } else {
      await sendQuestion(ctx);
    }
  } catch (error) {
    console.error('proceedToNextQuestion xatosi:', error);
    await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urining /start');
  }
};

// Natijalarni ko'rsatish
const showResults = async (ctx) => {
  try {
    stopTimer(ctx);

    const { correctAnswers, totalQuestions, level } = ctx.session;
    const percent = Math.round((correctAnswers / totalQuestions) * 100);

    let comment = '';
    let emoji = '';
    if (percent >= 90) {
      comment = '🎉 Ajoyib natija! Siz haqiqiy professional!';
      emoji = '🏆';
    } else if (percent >= 75) {
      comment = '👍 Juda yaxshi! Zoʻr!';
      emoji = '⭐';
    } else if (percent >= 60) {
      comment = '👌 Yaxshi natija!';
      emoji = '✅';
    } else if (percent >= 40) {
      comment = '📚 Oʻrtacha. Yana mashq qiling!';
      emoji = '📖';
    } else {
      comment = '💪 Yana oʻqish kerak. Hechqisi yoʻq, davom eting!';
      emoji = '🎯';
    }

    const resultText = 
      `🎊 <b>TEST YAKUNLANDI!</b>\n\n` +
      `📊 Daraja: <b>${level}</b>\n` +
      `✅ To'g'ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>\n` +
      `📈 Foiz: <b>${percent}%</b>\n\n` +
      `${emoji} ${comment}\n\n` +
      `🔄 Yana sinab ko'rish uchun /start bosing!`;

    await ctx.replyWithHTML(resultText);

    // Session tozalash
    ctx.session = {};
  } catch (error) {
    console.error('showResults xatosi:', error);
    await ctx.reply('❌ Natijalarni koʻrsatishda xatolik yuz berdi.');
  }
};

// Timer tugaganda avtomatik keyingi savolga o'tish
setOnTimeUp(proceedToNextQuestion);

module.exports = {
  startQuiz,
  selectLevel,
  handleAnswer,
  sendQuestion,
  proceedToNextQuestion,
  showResults
};