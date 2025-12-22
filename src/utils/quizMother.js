// src/utils/quizMother.js

const { motherTongueQuestions, topics } = require('./questions_mother');
const { Markup } = require('telegraf');
const { updateBestScore } = require('./users');

let activeQuizzes = {};

const startMotherQuiz = async (ctx, topicIndex) => {
  const userId = ctx.from.id;
  activeQuizzes[userId] = {
    questions: motherTongueQuestions.slice(topicIndex * 20, topicIndex * 20 + 20),
    current: 0,
    score: 0,
    topic: topics[topicIndex]
  };
  try {
    await sendQuestion(ctx);
  } catch (e) {
    console.error('startMotherQuiz xatosi:', e && e.message ? e.message : e);
  }
};

const sendQuestion = async (ctx) => {
  const quiz = activeQuizzes[ctx.from.id];
  if (!quiz || quiz.current >= quiz.questions.length) return endQuiz(ctx);

  const q = quiz.questions[quiz.current];
  
  // Variantlarni to'g'ri formatda yasash
  const optionEmojis = ['🅰️', '🅱️', '🆎', '🆑'];
  const buttons = q.options.map((opt, i) => {
    const letter = ['A', 'B', 'C', 'D'][i];
    // Variant matnini olish (A) 8 -> faqat "8" qismi)
    const optionText = opt.substring(3); // "A) " dan keyingi qismini olish
    // Tugma matnida harf va variant matnini ko'rsatish
    return [Markup.button.callback(`${optionEmojis[i] || '📌'} ${letter}) ${optionText}`, `mother_ans_${i}`)];
  });
  
  buttons.push([Markup.button.callback('⏹️ Testni tugatish', 'end_mother_quiz')]);

  try {
    await ctx.replyWithHTML(
      `📚 <b>${quiz.topic}</b>\n\n` +
      `📝 Savol <b>${quiz.current + 1}</b>/20\n\n` +
      `${q.question}`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  } catch (e) {
    console.error('sendQuestion xatosi:', e && e.message ? e.message : e);
  }
};

const handleMotherAnswer = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const quiz = activeQuizzes[userId];
    if (!quiz) return;

    const selectedIndex = parseInt(ctx.match[0].split('_')[2]);
    const q = quiz.questions[quiz.current];
    const correctIndex = q.correct;

    // Javobni tekshirish
    const isCorrect = selectedIndex === correctIndex;
    const userLetter = ['A', 'B', 'C', 'D'][selectedIndex];
    const correctLetter = ['A', 'B', 'C', 'D'][correctIndex];

    if (isCorrect) {
      quiz.score++;
    }

    // Variant matnlarini olish
    const userOptionText = q.options[selectedIndex].substring(3);
    const correctOptionText = q.options[correctIndex].substring(3);

    // JAVOB XABARI - ALOHIDA XABAR KO'RINISHIDA
    let resultMessage = '';
    
    if (isCorrect) {
      resultMessage = 
        `✅ <b>TO'G'RI JAVOB!</b>\n\n` +
        `👤 Siz tanladingiz: <b>${userLetter}. ${userOptionText}</b>\n` +
        `🎉 Ajoyib! Bu to'g'ri javob!\n\n`;
    } else {
      resultMessage = 
        `❌ <b>NOTO'G'RI JAVOB!</b>\n\n` +
        `👤 Siz tanladingiz: <b>${userLetter}. ${userOptionText}</b>\n` +
        `✅ To'g'ri javob: <b>${correctLetter}. ${correctOptionText}</b>\n\n`;
    }
    
    // Tushuntirish qo'shish
    if (q.explanation) {
      resultMessage += `💡 <i>${q.explanation}</i>\n`;
    } else {
      resultMessage += `💡 <i>Tushuntirish mavjud emas</i>\n`;
    }

    // Alohida xabar sifatida javobni yuborish
    try {
      await ctx.replyWithHTML(resultMessage);
    } catch (e) {
      console.error('replyWithHTML xatosi:', e && e.message ? e.message : e);
    }

    // Keyingi savolga o'tish
    quiz.current++;
    
    if (quiz.current >= quiz.questions.length) {
      setTimeout(() => endQuiz(ctx), 2000);
    } else {
      setTimeout(() => sendQuestion(ctx), 2000);
    }

  } catch (error) {
    console.error('handleMotherAnswer xatosi:', error);
    try { await ctx.reply('❌ Javobni qayta ishlashda xatolik yuz berdi.'); } catch (e) { console.error('notify user error:', e && e.message ? e.message : e); }
  }
};

const handleEndQuiz = async (ctx) => {
  try {
    await ctx.answerCbQuery('Test tugadi!');
  } catch (e) { console.error('answerCbQuery xatosi:', e && e.message ? e.message : e); }
  try { await endQuiz(ctx); } catch (e) { console.error('endQuiz xatosi:', e && e.message ? e.message : e); }
};

const endQuiz = async (ctx) => {
  const userId = ctx.from.id;
  const quiz = activeQuizzes[userId];
  if (!quiz) return;

  const score = quiz.score;
  const total = quiz.questions.length;
  const percentage = Math.round((score / total) * 100);
  
  // Update user's best score
  try {
    updateBestScore(userId, score);
  } catch (e) {
    console.error('updateBestScore xatosi:', e);
  }
  
  let comment = '';
  let emoji = '';
  if (percentage >= 90) {
    comment = '🎉 Ajoyib natija! Siz haqiqiy professional!';
    emoji = '🏆';
  } else if (percentage >= 75) {
    comment = '👍 Juda yaxshi! Zoʻr!';
    emoji = '⭐';
  } else if (percentage >= 60) {
    comment = '👌 Yaxshi natija!';
    emoji = '✅';
  } else if (percentage >= 40) {
    comment = '📚 Oʻrtacha. Yana mashq qiling!';
    emoji = '📖';
  } else {
    comment = '💪 Yana oʻqish kerak. Hechqisi yoʻq, davom eting!';
    emoji = '🎯';
  }

  const resultText = 
    `🏁 <b>TEST YAKUNLANDI!</b>\n\n` +
    `📊 Mavzu: <b>${quiz.topic}</b>\n` +
    `✅ To'g'ri javoblar: <b>${score}/${total}</b>\n` +
    `📈 Foiz: <b>${percentage}%</b>\n\n` +
    `${emoji} ${comment}\n\n` +
    `🔄 Boshqa testlar uchun /start bosing!`;

  try {
    await ctx.replyWithHTML(resultText);
  } catch (e) { console.error('endQuiz reply xatosi:', e && e.message ? e.message : e); }
  
  delete activeQuizzes[userId];
};

module.exports = { 
  startMotherQuiz, 
  handleMotherAnswer, 
  handleEndQuiz
};