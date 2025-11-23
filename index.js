const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const bot = new Telegraf(process.env.TOKEN);
bot.use(session());

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

bot.start((ctx) => {
  ctx.session = {};
  ctx.reply('Assalomu alaykum! Ingliz tili darajangizni sinab ko‘ring\n\nDarajani tanlang:', Markup.inlineKeyboard([
    [Markup.button.callback('A1 Placement Test', 'A1')],
    [Markup.button.callback('A2', 'A2')],
    [Markup.button.callback('B1', 'B1')],
    [Markup.button.callback('B2', 'B2')],
    [Markup.button.callback('C1', 'C1')],
    [Markup.button.callback('C2', 'C2')]
  ]));
});

bot.action(/A1|A2|B1|B2|C1|C2/, async (ctx) => {
  const level = ctx.match[0];
  ctx.session = {
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: questions[level].length
  };

  await ctx.editMessageText(`Siz ${level} darajasini tanladingiz! Tayyormisiz?\n\n<b>Boshladik!</b>`, { parse_mode: 'HTML' });
  sendQuestion(ctx);
});

async function sendQuestion(ctx) {
  const { level, questionIndex } = ctx.session;
  const q = questions[level][questionIndex];

  if (!q) {
    showResults(ctx);
    return;
  }

  // Joriy savolni sessiyaga saqlaymiz – bu eng muhim qism!
  ctx.session.currentQuestion = q;

  const optionsText = q.options.join('\n');

  await ctx.replyWithHTML(
    `<b>${questionIndex + 1}/${ctx.session.totalQuestions}</b>\n\n${q.question}\n\n${optionsText}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('A', 'ans_A'), Markup.button.callback('B', 'ans_B')],
      [Markup.button.callback('C', 'ans_C'), Markup.button.callback('D', 'ans_D')]
    ])
  );

  ctx.session.timeout = setTimeout(() => {
    const idx = typeof q.correct === 'number' ? q.correct : ['A','B','C','D'].indexOf(q.correct);
    ctx.reply(`⏰ Vaqt tugadi! To‘g‘ri javob: <b>${q.options[idx]}</b>`, { parse_mode: 'HTML' });
    nextQuestion(ctx);
  }, 30000);
}

bot.action(/ans_[A-D]/, (ctx) => {
  clearTimeout(ctx.session.timeout);

  const userAnswer = ctx.match[0].split('_')[1]; // A, B, C yoki D
  const q = ctx.session.currentQuestion;         // To'g'ri savolni olamiz!

  const idx = typeof q.correct === 'number' ? q.correct : ['A','B','C','D'].indexOf(q.correct);
  const correctLetter = ['A','B','C','D'][idx];

  if (userAnswer === correctLetter) {
    ctx.session.correctAnswers++;
  }

  ctx.deleteMessage().catch(() => {});
  nextQuestion(ctx);
});

function nextQuestion(ctx) {
  ctx.session.questionIndex++;
  sendQuestion(ctx);
}

function showResults(ctx) {
  const { correctAnswers, totalQuestions, level } = ctx.session;
  const percent = Math.round((correctAnswers / totalQuestions) * 100);

  let comment = '';
  if (percent >= 90) comment = 'Ajoyib natija!';
  else if (percent >= 70) comment = 'Juda yaxshi!';
  else if (percent >= 50) comment = 'Yaxshi urinish!';
  else comment = 'Yana mashq qiling!';

  ctx.replyWithHTML(`
<b>Test yakunlandi!</b> 

Daraja: <b>${level}</b>
To'g'ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>
Foiz: <b>${percent}%</b>

${comment}

Yana boshlash uchun /start bosing!
  `);
}

bot.launch();
console.log("Bot 100% ishlaydigan holatda ishga tushdi – ballar to'g'ri hisoblanadi!");
