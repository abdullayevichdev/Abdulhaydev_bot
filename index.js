const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const bot = new Telegraf(process.env.TOKEN);
bot.use(session());

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

bot.start((ctx) => {
  ctx.session = {};
  ctx.reply('Assalomu alaykum! Ingliz tili darajangizni sinab ko‘ring\n\nDarajani tanlang:', Markup.inlineKeyboard([
    [Markup.button.callback('A1', 'A1')],
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

  await ctx.editMessageText(`Siz ${level} darajasini tanladingiz!\n\n<b>Boshladik!</b>`, { parse_mode: 'HTML' });
  sendQuestion(ctx);
});

async function sendQuestion(ctx) {
  const { level, questionIndex } = ctx.session;
  const q = questions[level][questionIndex];

  if (!q) {
    showResults(ctx);
    return;
  }

  // Eng muhim: joriy savolni saqlaymiz
  ctx.session.currentQuestion = q;

  const optionsText = q.options.join('\n');

  const msg = await ctx.replyWithHTML(
    `<b>${questionIndex + 1}/${ctx.session.totalQuestions}</b>\n\n${q.question}\n\n${optionsText}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('A', 'ans_A'), Markup.button.callback('B', 'ans_B')],
      [Markup.button.callback('C', 'ans_C'), Markup.button.callback('D', 'ans_D')]
    ])
  );

  // Timer
  let timeLeft = 30;
  const timerMsg = await ctx.reply(getTimerText(timeLeft));
  ctx.session.timerMessageId = timerMsg.message_id;

  ctx.session.timerInterval = setInterval(async () => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(ctx.session.timerInterval);
      const correctIdx = getCorrectIndex(q);
      await ctx.telegram.editMessageText(ctx.chat.id, timerMsg.message_id, null,
        `Vaqt tugadi! To‘g‘ri javob: <b>${q.options[correctIdx]}</b>`, { parse_mode: 'HTML' });
      nextQuestion(ctx);
    } else {
      await ctx.telegram.editMessageText(ctx.chat.id, timerMsg.message_id, null, getTimerText(timeLeft));
    }
  }, 1000);

  ctx.session.timeout = setTimeout(() => {
    if (ctx.session.timerInterval) clearInterval(ctx.session.timerInterval);
    nextQuestion(ctx);
  }, 30000);
}

// Raqam yoki harf bo‘lsa ham ishlaydi
function getCorrectIndex(q) {
  if (typeof q.correct === 'number') return q.correct;
  if (typeof q.correct === 'string') return ['A', 'B', 'C', 'D'].indexOf(q.correct.toUpperCase());
  return 0;
}

function getTimerText(seconds) {
  const filled = '🟩'.repeat(Math.round(seconds / 3));
  const empty = '⬜'.repeat(10 - Math.round(seconds / 3));
  return `<b>⏰ Vaqt: ${seconds} sekund</b>\n${filled}${empty}`;
}

bot.action(/ans_[A-D]/, (ctx) => {
  clearTimeout(ctx.session.timeout);
  if (ctx.session.timerInterval) clearInterval(ctx.session.timerInterval);
  if (ctx.session.timerMessageId) {
    ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.timerMessageId).catch(() => {});
  }

  const userAnswer = ctx.match[0].split('_')[1]; // A, B, C, D
  const q = ctx.session.currentQuestion;

  const correctIdx = getCorrectIndex(q);
  const correctLetter = ['A', 'B', 'C', 'D'][correctIdx];

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
  if (percent >= 90) comment = 'Ajoyib!';
  else if (percent >= 70) comment = 'Juda yaxshi!';
  else if (percent >= 50) comment = 'Yaxshi!';
  else comment = 'Yana mashq qiling!';

  ctx.replyWithHTML(`
${comment} <b>Test yakunlandi!</b> ${comment}

Daraja: <b>${level}</b>
To‘g‘ri javoblar: <b>${correctAnswers}/${totalQuestions}</b>
Foiz: <b>${percent}%</b>

Yana boshlash uchun /start bosing!
  `);
}

bot.launch();
console.log("Bot 100% to‘g‘ri ball hisoblaydi + vaqt ko‘rsatadi!");
