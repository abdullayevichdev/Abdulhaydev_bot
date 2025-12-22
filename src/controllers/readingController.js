const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { startTimer, stopTimer, setOnTimeUp, getTimerText } = require('../utils/timer');

// Load reading tests
const readingTestsPath = path.join(__dirname, '../../reading_tests.json');
const readingTests = JSON.parse(fs.readFileSync(readingTestsPath, 'utf8'));

const startReadingTest = (ctx) => {
  ctx.session = {};
  return ctx.reply(
    '📖 Reading test boshlanmoqda!\n\n📊 O\'zingizga mos darajani tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🟢 A1', 'reading_A1')],
      [Markup.button.callback('🔵 A2', 'reading_A2')],
      [Markup.button.callback('🟡 B1', 'reading_B1')],
      [Markup.button.callback('🟠 B2', 'reading_B2')],
      [Markup.button.callback('🔴 C1', 'reading_C1')],
      [Markup.button.callback('🟣 C2', 'reading_C2')],
      [Markup.button.callback('🔙 Asosiy menyu', 'back_to_main')]
    ])
  );
};

const selectReadingLevel = async (ctx) => {
  const level = ctx.match[1]; // Extract level from 'reading_A1' format
  
  // Initialize session for reading test
  ctx.session = {
    testType: 'reading',
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: readingTests[level].length,
    questions: readingTests[level]
  };

  await ctx.editMessageText(
    `🎯 Siz <b>${level}</b> darajadagi reading testini tanladingiz!\n\n📝 Test <b>${readingTests[level].length}</b> ta savoldan iborat.\n\n🚀 Tayyormisiz?`,
    { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('✅ Boshlash', 'start_reading_test')],
          [Markup.button.callback('🔙 Orqaga', 'back_to_reading_menu')]
        ]
      }
    }
  );
};

const startSelectedReadingTest = async (ctx) => {
  await ctx.deleteMessage();
  await sendReadingQuestion(ctx);
};

const sendReadingQuestion = async (ctx) => {
  try {
    const { level, questionIndex, questions } = ctx.session;
    const question = questions[questionIndex];
    
    // Format the message with the reading passage and question
    const message = `📖 <b>Reading Passage (${questionIndex + 1}/${questions.length})</b>\n\n` +
                   `${question.passage}\n\n` +
                   `❓ <b>Savol:</b> ${question.question}`;

    // Create answer buttons
    const answerButtons = question.options.map((option, index) => {
      const letter = String.fromCharCode(65 + index); // A, B, C, D
      const emoji = ['🅰️', '🅱️', '🆎', '🆑'][index] || '📌';
      return [Markup.button.callback(`${emoji} ${letter}. ${option}`, `reading_ans_${index}`)];
    });

    // Add navigation and pause buttons
    answerButtons.push([
      Markup.button.callback('⏭️ Keyingi savol', 'reading_next'),
      Markup.button.callback('⏸️ Pauza', 'reading_pause')
    ]);

    // Send the question
    const sentMessage = await ctx.replyWithHTML(message, {
      reply_markup: {
        inline_keyboard: answerButtons
      }
    });

    // Save message ID for later cleanup
    ctx.session.questionMessageId = sentMessage.message_id;
    
    // Start timer for the reading question (30 seconds)
    // Send a timer message so the timer module can edit it each second
    const timerMsg = await ctx.reply(getTimerText(30, 30), { parse_mode: 'HTML' });
    ctx.session.timerMessageId = timerMsg.message_id;
    startTimer(ctx, null, timerMsg, 30); // 30 seconds for reading questions

  } catch (error) {
    console.error('Error sending reading question:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
};

const handleReadingAnswer = async (ctx, answerIndex) => {
  try {
    // Avval callback query ni javoblaymiz
    await ctx.answerCbQuery();
    
    // Handle pause button
    if (ctx.match && ctx.match[0] === 'reading_pause') {
      if (ctx.session.timer) {
        stopTimer(ctx);
        
        // Save current state
        ctx.session.isPaused = true;
        
        await ctx.answerCbQuery('⏸️ Test to\'xtatildi');
        
        // Show only the Restart button
        return ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [{ text: '🔄 Qayta boshlash', callback_data: 'reading_restart' }]
          ]
        });
      }
      return ctx.answerCbQuery();
    }
    
    // Session tekshirish
    if (!ctx.session || !ctx.session.questions) {
      return await ctx.reply('❌ Xatolik: Session topilmadi. /start bosing.');
    }
    
    const { questionIndex, questions, correctAnswers } = ctx.session;
    
    // QuestionIndex tekshirish
    if (questionIndex >= questions.length) {
      return await ctx.reply('❌ Xatolik: Savol topilmadi.');
    }
    
    const question = questions[questionIndex];
    
    // Stop the timer
    stopTimer(ctx);
    
    // Delete the previous question message
    if (ctx.session.questionMessageId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.questionMessageId).catch(() => {});
    }

    // Check if answer is correct
    let message = '';
    if (answerIndex !== null && answerIndex === question.correct) {
      ctx.session.correctAnswers = correctAnswers + 1;
      message = '✅ <b>TO\'G\'RI JAVOB!</b>\n\n🎉 Ajoyib! Bu to\'g\'ri javob!\n\n';
    } else if (answerIndex !== null) {
      const correctLetter = String.fromCharCode(65 + question.correct);
      message = `❌ <b>NOTO'G'RI JAVOB!</b>\n\n✅ To'g'ri javob: <b>${correctLetter}. ${question.options[question.correct]}</b>\n\n`;
    } else {
      const correctLetter = String.fromCharCode(65 + question.correct);
      message = `⏰ <b>VAQT TUGADI!</b>\n\n✅ To'g'ri javob: <b>${correctLetter}. ${question.options[question.correct]}</b>\n\n`;
    }

    // Add explanation if available
    if (question.explanation) {
      message += `💡 <i>Tushuntirish:</i> ${question.explanation}\n\n`;
    }

    // Move to next question or show results
    ctx.session.questionIndex++;
    
    if (ctx.session.questionIndex < questions.length) {
      message += `⏭️ Keyingi savolga o'tish uchun pastdagi tugmani bosing.`;
      
      const sentMessage = await ctx.replyWithHTML(message, {
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('⏭️ Keyingi savol', 'reading_next')]
          ]
        }
      });
      
      // Save message ID for cleanup
      ctx.session.questionMessageId = sentMessage.message_id;
      
    } else {
      // Show final results
      await showReadingResults(ctx, message);
    }

  } catch (error) {
    console.error('Error handling reading answer:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
};

const showReadingResults = async (ctx, previousMessage = '') => {
  const { correctAnswers, totalQuestions } = ctx.session;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  
  let message = previousMessage + '\n';
  message += '🎊 <b>TEST YAKUNLANDI!</b>\n\n';
  message += `📊 Daraja: <b>${ctx.session.level}</b>\n`;
  message += `✅ To'g'ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>\n`;
  message += `📈 Foiz: <b>${percentage}%</b>\n\n`;
  
  // Add some encouragement based on the score
  let emoji = '';
  if (percentage >= 90) {
    emoji = '🏆';
    message += `${emoji} <b>Ajoyib natija! Siz haqiqiy professional!</b>\n\n👏 Juda yaxshi ish qildingiz!`;
  } else if (percentage >= 75) {
    emoji = '⭐';
    message += `${emoji} <b>Juda yaxshi! Zo'r!</b>\n\n👍 Yaxshi ish!`;
  } else if (percentage >= 60) {
    emoji = '✅';
    message += `${emoji} <b>Yaxshi natija!</b>\n\n👌 Yana bir bor urinib ko'ring, yaxshiroq natijaga erishasiz!`;
  } else if (percentage >= 40) {
    emoji = '📖';
    message += `${emoji} <b>O'rtacha.</b>\n\n📚 Qo'shimcha mashq qilishingiz kerak. Qayta urinib ko'ring!`;
  } else {
    emoji = '🎯';
    message += `${emoji} <b>Yana o'qish kerak.</b>\n\n💪 Hechqisi yo'q, davom eting!`;
  }
  
  // Add restart button
  message += '\n\n🔄 Yana test ishlashni xohlaysizmi?';
  
  await ctx.replyWithHTML(message, {
    reply_markup: {
      inline_keyboard: [
        [Markup.button.callback('🔄 Qayta boshlash', 'reading_restart')],
        [Markup.button.callback('🏠 Asosiy menyu', 'back_to_main')]
      ]
    }
  });
  
  // Clean up session
  delete ctx.session.questionIndex;
  delete ctx.session.questions;
};

const handleReadingNavigation = async (ctx) => {
  const action = ctx.match[0];
  
  // Handle pause buttons
  if (action === 'reading_pause') {
    if (ctx.session.timer) {
      stopTimer(ctx);
      
      // Save current state
      ctx.session.isPaused = true;
      
      await ctx.answerCbQuery('Test to\'xtatildi');
      
      // Show only the Restart button
      return ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: '🔄 Qayta boshlash', callback_data: 'reading_restart' }]
        ]
      });
    }
    return ctx.answerCbQuery();
  }
  
  switch (action) {
    case 'reading_next':
      await sendReadingQuestion(ctx);
      break;
    case 'reading_restart':
      // Reset the session and start over
      ctx.session.questionIndex = 0;
      ctx.session.correctAnswers = 0;
      await ctx.deleteMessage().catch(() => {});
      await startReadingTest(ctx);
      break;
    case 'back_to_reading_menu':
      await startReadingTest(ctx);
      break;
    case 'back_to_main':
      await ctx.deleteMessage();
      // You'll need to import and call your main menu function here
      // For example: await showMainMenu(ctx);
      break;
  }
};

// Set up the onTimeUp callback for the timer
setOnTimeUp((ctx) => handleReadingAnswer(ctx, null));

module.exports = {
  startReadingTest,
  selectReadingLevel,
  startSelectedReadingTest,
  handleReadingAnswer,
  handleReadingNavigation
};
