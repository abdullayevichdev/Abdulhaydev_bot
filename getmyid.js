// getmyid.js  ← shu faylni yaratib, ichiga shuni joylashtiring

require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(`Sizning ID: ${ctx.from.id}\nIsmingiz: ${ctx.from.first_name}`);
});

bot.command('id', (ctx) => {
  ctx.reply(`Sizning ID raqamingiz:\n\n${ctx.from.id}`);
});

bot.on('text', (ctx) => {
  ctx.reply(`Salom! Sizning ID: ${ctx.from.id}`);
});

console.log('ID beruvchi bot ishga tushdi...');
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));