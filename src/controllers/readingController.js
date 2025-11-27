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
    'Reading test boshlanmoqda! O\'zingizga mos darajani tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('A1', 'reading_A1')],
      [Markup.button.callback('A2', 'reading_A2')],
      [Markup.button.callback('B1', 'reading_B1')],
      [Markup.button.callback('B2', 'reading_B2')],
      [Markup.button.callback('C1', 'reading_C1')],
      [Markup.button.callback('C2', 'reading_C2')],
      [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
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
    `Siz ${level} darajadagi reading testini tanladingiz!\n\nTest ${readingTests[level].length} ta savoldan iborat.\n\nTayyormisiz?`,
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
    const message = `📖 *Reading Passage (${questionIndex + 1}/${questions.length})*\n\n` +
                   `${question.passage}\n\n` +
                   `*Savol:* ${question.question}`;

    // Create answer buttons
    const answerButtons = question.options.map((option, index) => {
      const letter = String.fromCharCode(65 + index); // A, B, C, D
      return [Markup.button.callback(`${letter}. ${option}`, `reading_ans_${index}`)];
    });

    // Add navigation and pause buttons
    answerButtons.push([
      Markup.button.callback('⏭️ Keyingi savol', 'reading_next'),
      Markup.button.callback('⏸️ Pauza', 'reading_pause')
    ]);

    // Send the question
    const sentMessage = await ctx.reply(message, {
      parse_mode: 'Markdown',
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
    // Handle pause button
    if (ctx.match && ctx.match[0] === 'reading_pause') {
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
    const { questionIndex, questions, correctAnswers } = ctx.session;
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
      message = '✅ *To\'g\'ri!*\n\n';
      await ctx.reply('✅ To\'g\'ri!');
    } else if (answerIndex !== null) {
      const correctLetter = String.fromCharCode(65 + question.correct);
      message = `❌ *Noto'g'ri!*\nTo'g'ri javob: *${correctLetter}. ${question.options[question.correct]}*\n\n`;
      await ctx.reply('❌ Noto\'g\'ri!');
    } else {
      const correctLetter = String.fromCharCode(65 + question.correct);
      message = `⏰ *Vaqt tugadi!*\nTo'g'ri javob: *${correctLetter}. ${question.options[question.correct]}*\n\n`;
    }

    // Add explanation if available
    if (question.explanation) {
      message += `💡 *Tushuntirish:* ${question.explanation}\n\n`;
    }

    // Move to next question or show results
    ctx.session.questionIndex++;
    
    if (ctx.session.questionIndex < questions.length) {
      message += `Keyingi savolga o'tish uchun pastdagi tugmani bosing.`;
      
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
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
  message += '📊 *Test yakunlandi!*\n\n';
  message += `✅ To'g'ri javoblar: *${correctAnswers}* / ${totalQuestions}\n`;
  message += `📈 Natija: *${percentage}%*\n\n`;
  
  // Add some encouragement based on the score
  if (percentage >= 80) {
    message += 'Ajoyib natija! Juda yaxshi ish qildingiz! 👏';
  } else if (percentage >= 60) {
    message += 'Yaxshi ish! Yana bir bor urinib ko\'ring, yaxshiroq natijaga erishasiz.';
  } else {
    message += 'Qo\'shimcha mashq qilishingiz kerak. Qayta urinib ko\'ring!';
  }
  
  // Add restart button
  message += '\n\nYana test ishlashni xohlaysizmi?';
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [Markup.button.callback('🔄 Qayta boshlash', 'reading_restart')],
        [Markup.button.callback('🏠 Bosh menyu', 'back_to_main')]
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
