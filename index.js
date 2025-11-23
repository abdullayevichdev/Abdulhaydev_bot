const { Telegraf, Markup, session } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const bot = new Telegraf(process.env.TOKEN);
bot.use(session());

// questions.json faylini o‘qing
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

// /start komandasi
bot.start((ctx) => {
  ctx.session = {}; // sessiyani tozalash
  ctx.reply('Assalomu alaykum! Ingliz tili darajangizni sinab ko‘ring\n\nDarajani tanlang:', Markup.inlineKeyboard([
    [Markup.button.callback('A1', 'A1')],
    [Markup.button.callback('A2', 'A2')],
    [Markup.button.callback('B1', 'B1')],
    [Markup.button.callback('B2', 'B2')],
    [Markup.button.callback('C1', 'C1')],
    [Markup.button.callback('C2', 'C2')]
  ]));
});

// Level tanlash
bot.action(/A1|A2|B1|B2|C1|C2/, async (ctx) => {
  const level = ctx.match[0];
  ctx.session = {
    level,
    questionIndex: 0,
    correctAnswers: 0,
    totalQuestions: questions[level].length,
    selectedAnswers: [] // agar keyinroq ko‘rsatmoqchi bo‘lsangiz foydali
  };

  await ctx.editMessageText(`Siz ${level} darajasini tanladingiz!\nJami 30 ta savol. Tayyormisiz?\n\n1-savol kelyapti...`, { parse_mode: 'HTML' });
  setTimeout(() => sendQuestion(ctx), 1500);
});

// Savolni yuborish funksiyasi
async function sendQuestion(ctx) {
  const { level, questionIndex } = ctx.session;
  const q = questions[level][questionIndex];

  if (!q) {
    showResults(ctx);
    return;
  }

  const optionsText = q.options.join('\n');

  await ctx.replyWithHTML(
    `<b>${questionIndex + 1}/${ctx.session.totalQuestions}</b>\n\n${q.question}\n\n${optionsText}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('A', 'ans_A'), Markup.button.callback('B', 'ans_B')],
      [Markup.button.callback('C', 'ans_C'), Markup.button.callback('D', 'ans_D')]
    ])
  );

  // 30 soniya vaqt beramiz
  ctx.session.timeout = setTimeout(() => {
    ctx.reply(`⏰ Vaqt tugadi! To‘g‘ri javob: <b>${q.answer}</b>`, { parse_mode: 'HTML' });
    nextQuestion(ctx);
  }, 30000);
}

// Javobni qabul qilish (hech narsa demaymiz, faqat yozib olamiz)
bot.action(/ans_[A-D]/, (ctx) => {
  clearTimeout(ctx.session.timeout);

  const userAnswer = ctx.match[0].split('_')[1]; // ans_A → A
  const { level, questionIndex } = ctx.session;
  const correctAnswer = questions[level][questionIndex].answer;

  // Javobni saqlaymiz
  if (userAnswer === correctAnswer) {
    ctx.session.correctAnswers++;
  }

  // Hech qanday "To‘g‘ri" yoki "Noto‘g‘ri" demaymiz!
  // Faqat keyingi savolga o‘tamiz
  ctx.deleteMessage().catch(() => {}); // eski xabarni o‘chiramiz (ixtiyoriy)
  nextQuestion(ctx);
});

// Keyingi savolga o‘tish
function nextQuestion(ctx) {
  ctx.session.questionIndex++;
  setTimeout(() => sendQuestion(ctx), 800); // biroz pauza
}

// Natijani ko‘rsatish
function showResults(ctx) {
  const { correctAnswers, totalQuestions, level } = ctx.session;
  const wrongAnswers = totalQuestions - correctAnswers;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  let emoji = '';
  if (percentage >= 90) emoji = '';
  else if (percentage >= 70) emoji = '';
  else if (percentage >= 50) emoji = '';
  else emoji = '';

  const resultText = `
${emoji} <b>Test yakunlandi!</b> ${emoji}

Daraja: <b>${level}</b>
To‘g‘ri javoblar: <b>${correctAnswers}/30</b>
Noto‘g‘ri javoblar: <b>${wrongAnswers}/30</b>
Foiz: <b>${percentage}%</b>

${percentage >= 80 ? 'Ajoyib natija! Davom eting' : 'Yaxshi urinish! Yana mashq qiling'}

Yana sinab ko‘rmoqchi bo‘lsangiz /start buyrug‘ini bering!
`;

  ctx.replyWithHTML(resultText);
}

bot.launch();
console.log("Bot ishga tushdi! Endi faqat oxirida natija chiqadi");