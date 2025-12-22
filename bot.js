require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const path = require('path');

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined in .env');
}

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// Enable session middleware
bot.use(session());

// Import controllers
const { startQuiz, selectLevel, handleAnswer } = require('./src/controllers/quizController');
const { startReadingTest } = require('./src/controllers/readingController');

// Command handlers
bot.start(async (ctx) => {
  // Clear any existing session
  ctx.session = {};
  
  // Show the level selection menu
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
});

// Callback query handler
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.update.callback_query.data;
    const message = ctx.update.callback_query.message;
    
    // Always answer the callback query to remove the loading state
    await ctx.answerCbQuery();
    
    console.log('Button pressed:', data); // Debug log
    
    // Handle answer buttons (A, B, C, D)
    if (data.startsWith('ans_')) {
      // Set up the callbackQuery object that handleAnswer expects
      ctx.callbackQuery = ctx.update.callback_query;
      await handleAnswer(ctx);
      return;
    }
    
    // Handle pause button
    if (data === 'pause_quiz') {
      ctx.callbackQuery = ctx.update.callback_query;
      await handleAnswer(ctx);
      return;
    }
    
    // Handle restart button
    if (data === 'restart_quiz') {
      ctx.callbackQuery = ctx.update.callback_query;
      await handleAnswer(ctx);
      return;
    }
    
    // Handle next question button
    if (data === 'next_question') {
      ctx.callbackQuery = ctx.update.callback_query;
      await handleAnswer(ctx);
      return;
    }
    
    // Handle English level selection (A1, A2, B1, etc.)
    if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(data)) {
      // Set the selected level in session
      ctx.session = ctx.session || {};
      ctx.session.level = data;
      
      // Prepare the context for quiz controller
      ctx.callbackQuery = ctx.update.callback_query;
      await selectLevel(ctx);
      return;
    }
  } catch (error) {
    console.error('Callback query xatosi:', error);
    try {
      await ctx.answerCbQuery('Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
    } catch (e) {
      console.error('Xatolik haqida xabar yuborishda xato:', e);
    }
  }
});

// Error handler
bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err);
  return ctx.reply('Kechirasiz, botda xatolik yuz berdi. Iltimos keyinroq qayta urinib ko\'ring.');
});

module.exports = bot;
