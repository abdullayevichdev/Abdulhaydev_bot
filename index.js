const { Telegraf, session } = require('telegraf');
const config = require('./config');
const { startQuiz, selectLevel, handleAnswer } = require('./src/controllers/quizController');

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
bot.start(startQuiz);

// Level selection
bot.action(/A1|A2|B1|B2|C1|C2/, selectLevel);

// Answer handling
bot.action(/ans_[A-D]/, handleAnswer);

// Error handling for unhandled actions
bot.on('message', (ctx) => {
  return ctx.reply('Iltimos, /start buyrug\'ini bosing yoki quyidagi tugmalardan foydalaning.');
});

// Start the bot
bot.launch()
  .then(() => console.log('Bot is running...'))
  .catch(err => {
    console.error('Error starting bot:', err);
    process.exit(1);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));