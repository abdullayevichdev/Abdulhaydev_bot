const { Telegraf, session, Scenes, Stage } = require('telegraf');
const { Markup } = require('telegraf');
const config = require('./config');
const { startQuiz, selectLevel, handleAnswer, sendQuestion } = require('./src/controllers/quizController');
const { 
  startReadingTest, 
  selectReadingLevel, 
  startSelectedReadingTest, 
  handleReadingAnswer, 
  handleReadingNavigation 
} = require('./src/controllers/readingController');
const { getTimerText } = require('./src/utils/timer');

// Initialize bot
const bot = new Telegraf(config.botToken);

// Session middleware
bot.use(session());

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  return ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring /start');
});

// Start command
bot.start((ctx) => {
  return ctx.reply(
    'Assalomu alaykum! Quyidagi menyudan kerakli bo\'limni tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📝 Oddiy Test', 'start_quiz')],
      [Markup.button.callback('📖 Reading Test', 'start_reading')]
    ])
  );
});

// Main menu navigation
bot.action('start_quiz', startQuiz);
bot.action('start_reading', startReadingTest);

// Handle quiz level selection
bot.action(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], selectLevel);

// Handle reading test level selection
bot.action(/reading_(A1|A2|B1|B2|C1|C2)/, selectReadingLevel);

// Handle reading test start
bot.action('start_reading_test', startSelectedReadingTest);

// Handle reading test answers
bot.action(/reading_ans_\d+/, (ctx) => {
  const answerIndex = parseInt(ctx.match[0].split('_')[2]);
  return handleReadingAnswer(ctx, answerIndex);
});

// Handle reading test navigation
bot.action(['reading_next', 'reading_restart', 'back_to_reading_menu', 'back_to_main', 'reading_pause'], handleReadingNavigation);

// Handle quiz answer selection
bot.action(/ans_[A-D]/, handleAnswer);

// Handle next question button
bot.action('next_question', handleAnswer);

// Handle pause button
bot.action('pause_quiz', handleAnswer);

// Handle resume button
bot.action('resume_quiz', handleAnswer);

// Handle restart button
bot.action('restart_quiz', handleAnswer);

// Launch bot
bot.launch()
  .then(() => {
    console.log("Bot muvaffaqiyatli ishga tushdi!");
  })
  .catch((err) => {
    console.error('Botni ishga tushirishda xatolik:', err);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
