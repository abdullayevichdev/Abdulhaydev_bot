require('dotenv').config();
const { Markup } = require('telegraf');
const config = require('./config');

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TOKEN || config.botToken;
if (!BOT_TOKEN) {
  console.error('BOT TOKEN topilmadi. Iltimos `.env` faylida BOT_TOKEN o\'rniga tokenni qo\'shing.');
  process.exit(1);
}

const ADMIN_ID = parseInt(process.env.ADMIN_ID || '6464089189', 10);

const { addUser, getStats, updateBestScore, getLeaderboard } = require('./src/utils/users');
const { motherTongueQuestions, topics } = require('./src/utils/questions_mother');
const { startMotherQuiz, handleMotherAnswer, handleEndQuiz } = require('./src/utils/quizMother');

const { startQuiz, selectLevel, handleAnswer } = require('./src/controllers/quizController');
const { startReadingTest, selectReadingLevel, startSelectedReadingTest, handleReadingAnswer, handleReadingNavigation } = require('./src/controllers/readingController');

const bot = require('./bot');

// Global error handler for Telegraf
bot.catch((err, ctx) => {
  console.error('Bot error:', err && err.message ? err.message : err);
});

// Log runtime/unhandled exceptions so polling doesn't silently die
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

// Yangilanish xabari matni (emoji bilan)
const getWelcomeMessage = () => {
  return `👋 <b>Assalomu Alaykum!</b>\n\n` +
    `🎉 Bot mukammal darajada yangilandi! ` +
    `Ko'plab testlar va qiziqarli ona-tilidan ham testlar qo'shildi. ` +
    `Sizdan botni aktiv ishlatishingizni so'raymiz! ` +
    `Agar botda biron muammo bo'lsa @Abdullayevich_devoloper ga murojat qilishingiz so'raladi!\n\n` +
    `🤝 <b>Hamkorlik uchun:</b> @Abdullayevich_devoloper`;
};

// Yangi foydalanuvchiga xabar yuborish funksiyasi
const sendWelcomeMessage = async (userId) => {
  try {
    await bot.telegram.sendMessage(userId, getWelcomeMessage(), {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  } catch (error) {
    // Xatolikni log qilish, lekin botni to'xtatmaslik
    if (error && error.response && error.response.error_code === 403) {
      console.log(`Foydalanuvchi bloklagan: ${userId}`);
    } else {
      console.error(`Xabar yuborishda xatolik (${userId}):`, error && error.message ? error.message : error);
    }
  }
};

// Barcha foydalanuvchilarga yangilanish xabarini yuborish funksiyasi
const sendWelcomeToAllUsers = async (ctx = null) => {
  try {
    const users = getStats().users;
    if (users.length === 0) {
      if (ctx) await ctx.reply('ℹ️ Hozircha foydalanuvchilar yo\'q');
      return;
    }

    let statusMsg;
    if (ctx) {
      try {
        statusMsg = await ctx.reply(`📤 Yangilanish xabari yuborilmoqda...\nJami: ${users.length} ta foydalanuvchi\nYuborildi: 0 ta\nBloklagan: 0 ta\nXatolar: 0 ta`);
      } catch (e) {
        console.error('Status msg yuborishda xato:', e && e.message ? e.message : e);
      }
    }

    let sent = 0, blocked = 0, errors = 0;
    const batchSize = 20;
    const delay = 1000;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      for (const user of batch) {
        try {
          await sendWelcomeMessage(user.id);
          sent++;
        } catch (e) {
          if (e && e.response && e.response.error_code === 403) {
            blocked++;
            console.log('Foydalanuvchi bloklagan', user.id);
          } else {
            errors++;
            console.error(`Xabar yuborishda xatolik (${user.id}):`, e && e.message ? e.message : e);
          }
        }
      }

      if (statusMsg && ctx) {
        try {
          await ctx.telegram.editMessageText(
            statusMsg.chat.id,
            statusMsg.message_id,
            undefined,
            `📤 Yangilanish xabari yuborilmoqda...\n🔄 Jarayon: ${Math.min(i + batchSize, users.length)}/${users.length} (${Math.round(((i + batchSize) / users.length) * 100)}%)\n✅ Yuborildi: ${sent} ta\n❌ Bloklagan: ${blocked} ta\n⚠️ Xatolar: ${errors} ta`,
            { parse_mode: 'Markdown' }
          );
        } catch (e) {
          console.error('Statusni yangilashda xato:', e && e.message ? e.message : e);
        }
      }

      if (i + batchSize < users.length) await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (statusMsg && ctx) {
      try {
        await ctx.telegram.editMessageText(
          statusMsg.chat.id,
          statusMsg.message_id,
          undefined,
          `✅ Yangilanish xabari yuborish yakunlandi!\n\n📊 Natijalar:\n• Jami: ${users.length} ta\n• Yuborildi: ${sent} ta\n• Bloklagan: ${blocked} ta\n• Xatolar: ${errors} ta`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error('Yakuniy status yuborishda xato:', e && e.message ? e.message : e);
      }
    }
  } catch (error) {
    console.error('Yangilanish xabarini yuborishda umumiy xatolik:', error && error.message ? error.message : error);
  }
};

// Start komandasi - yangi foydalanuvchilarga xabar yuboradi
bot.start(async (ctx) => {
  try {
    const isNewUser = !getStats().users.find(u => u.id === ctx.from.id);
    
    // Foydalanuvchini qo'shish
    addUser(ctx.from);
    
    // Agar yangi foydalanuvchi bo'lsa, yangilanish xabarini yuborish
    if (isNewUser) {
      await sendWelcomeMessage(ctx.from.id);
    }
    
    // Asosiy menyuni ko'rsatish (mavjud funksiyalar bilan)
    await startQuiz(ctx);
  } catch (error) {
    console.error('Start komandasi xatosi:', error && error.message ? error.message : error);
    try {
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos, qaytadan urining.');
    } catch (e) {
      console.error('Xabar yuborishda xatolik:', e);
    }
  }
});

// Admin uchun barcha foydalanuvchilarga yangilanish xabarini yuborish komandasi
bot.command('sendupdate', async (ctx) => {
  try {
    if (ctx.from.id !== ADMIN_ID) return await ctx.reply('❌ Ruxsat yo\'q!');
    await sendWelcomeToAllUsers(ctx);
  } catch (error) {
    console.error('Sendupdate komandasi xatosi:', error && error.message ? error.message : error);
  }
});

bot.command('broadcast', async (ctx) => {
  try {
    if (ctx.from.id !== ADMIN_ID) return await ctx.reply('❌ Ruxsat yo\'q!');

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) return await ctx.reply('📝 Iltimos, xabar matnini yozing:\n/broadcast Salom hammaga!');

    const users = getStats().users;
    if (users.length === 0) return await ctx.reply('ℹ️ Hozircha foydalanuvchilar yo‘q');

    let statusMsg;
    try { statusMsg = await ctx.reply(`📤 Xabar yuborish boshlandi...\nJami: ${users.length} ta foydalanuvchi\nYuborildi: 0 ta\nBloklagan: 0 ta\nXatolar: 0 ta`); } catch (e) { console.error('Status msg yuborishda xato:', e && e.message ? e.message : e); }

    let sent = 0, blocked = 0, errors = 0;
    const batchSize = 20; const delay = 1000;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      for (const user of batch) {
        try {
          await bot.telegram.sendMessage(user.id, `📢 *E'lon*\\n\\n${text}\\n\\n_📅 ${new Date().toLocaleString('uz-UZ')}_`, { parse_mode: 'MarkdownV2', disable_web_page_preview: true });
          sent++;
        } catch (e) {
          if (e && e.response && e.response.error_code === 403) { blocked++; console.log('Foydalanuvchi bloklagan', user.id); }
          else { errors++; console.error(`Xabar yuborishda xatolik (${user.id}):`, e && e.message ? e.message : e); }
        }
      }

      try {
        if (statusMsg) await ctx.telegram.editMessageText(statusMsg.chat.id, statusMsg.message_id, undefined, `📤 Xabar yuborilmoqda...\n🔄 Jarayon: ${Math.min(i + batchSize, users.length)}/${users.length} (${Math.round(((i + batchSize) / users.length) * 100)}%)\n✅ Yuborildi: ${sent} ta\n❌ Bloklagan: ${blocked} ta\n⚠️ Xatolar: ${errors} ta`, { parse_mode: 'Markdown' });
      } catch (e) { console.error('Statusni yangilashda xato:', e && e.message ? e.message : e); }

      if (i + batchSize < users.length) await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      if (statusMsg) await ctx.telegram.editMessageText(statusMsg.chat.id, statusMsg.message_id, undefined, `✅ Xabar yuborish yakunlandi!\n\n📊 Natijalar:\n• Jami: ${users.length} ta\n• Yuborildi: ${sent} ta\n• Bloklagan: ${blocked} ta\n• Xatolar: ${errors} ta`, { parse_mode: 'Markdown' });
      else await ctx.reply(`✅ Xabar yuborish yakunlandi!\nJami: ${users.length} ta\nYuborildi: ${sent} ta\nBloklagan: ${blocked} ta\nXatolar: ${errors} ta`);
    } catch (e) { console.error('Yakuniy status yuborishda xato:', e && e.message ? e.message : e); }

  } catch (error) { console.error('Broadcast umumiy xatosi:', error && error.message ? error.message : error); }
});

// BOTNI ISHGA TUSHIRISH
(
  async () => {
    try {
      await bot.launch();
      console.log('🤖 BOT 100% ISHLAYDI! Ona tili + Ingliz tili + Reyting + Broadcast – hammasi tayyor!');
    } catch (e) {
      console.error('Bot launch xatosi (yoqilgandek davom etadi):', e?.response || e);
    }
  }
)();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));