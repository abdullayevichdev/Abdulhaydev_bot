require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { Markup } = require('telegraf');
const config = require('./config');

// ==================== KANALGA A'ZO BO'LISHNI TEKSHIRISH ====================
const CHANNEL_USERNAME = '@Robotexnika_LSL';
const CHANNEL_CHAT_ID = -1002226585734; // O'z kanalingiz ID sini qo'ying

// Kanalga a'zo ekanligini tekshirish funksiyasi
const checkChannelMembership = async (ctx, next) => {
  try {
    const userId = ctx.from.id;
    
    // /start va tekshirish tugmasi uchun tekshirmaymiz
    if ((ctx.message && ctx.message.text === '/start') || (ctx.callbackQuery && ctx.callbackQuery.data === 'check_membership')) {
      return next();
    }

    // Kanalga a'zolikni tekshirish
    const member = await ctx.telegram.getChatMember(CHANNEL_CHAT_ID, userId);
    
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      return next();
    } else {
      // A'zo bo'lmasa, kanalga qo'shilishni so'rash
      await ctx.reply(
        `⚠️ <b>Botdan foydalanish uchun kanalimizga a'zo bo'ling!</b>\n\n` +
        `Quyidagi kanalga obuna bo'ling va "✅ Tekshirish" tugmasini bosing:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 Kanalga Qoʻshilish', url: `https://t.me/${CHANNEL_USERNAME.substring(1)}` }],
              [{ text: '✅ Tekshirish', callback_data: 'check_membership' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Kanal tekshirish xatosi:', error);
    return next();
  }
};

// Asosiy menyuni ko'rsatish funksiyasi
const showMainMenu = async (ctx) => {
  await ctx.reply(
    '🇺🇿 Assalomu alaykum! Bot yangilandi!\n\nQuyidagi testlardan birini tanlang:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🧪 Oddiy Test', 'start_quiz')],
      [Markup.button.callback('📖 Reading Test', 'start_reading')],
      [Markup.button.callback('📚 Ona tili testlari', 'mother_tongue')],
      [Markup.button.callback('🏆 Reyting', 'show_top')]
    ])
  );
};

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TOKEN || config.botToken;
if (!BOT_TOKEN) {
  console.error('BOT TOKEN topilmadi. Iltimos `.env` faylida BOT_TOKEN o\'rniga tokenni qo\'shing.');
  process.exit(1);
}

const { addUser, getStats, updateBestScore, getLeaderboard } = require('./src/utils/users');
const { motherTongueQuestions, topics } = require('./src/utils/questions_mother');
const { startMotherQuiz, handleMotherAnswer, handleEndQuiz } = require('./src/utils/quizMother');

const { startQuiz, selectLevel, handleAnswer } = require('./src/controllers/quizController');
const { startReadingTest, selectReadingLevel, startSelectedReadingTest, handleReadingAnswer, handleReadingNavigation } = require('./src/controllers/readingController');

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Kanal tekshirish middleware ni qo'shish
bot.use(checkChannelMembership);

// XATOLIKLAR
bot.catch((err, ctx) => {
  console.error('XATO:', err);
  ctx.reply('❌ Xatolik yuz berdi. /start bosing.');
});

// ==================== KANAL A'ZOLIGINI TEKSHIRISH CALLBACK ====================
bot.action('check_membership', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    
    const member = await ctx.telegram.getChatMember(CHANNEL_CHAT_ID, userId);
    
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      await ctx.editMessageText(
        '✅ <b>Rahmat! Kanalga a\'zo bo\'lganingiz uchun.</b>\n\n' +
        'Endi botdan to\'liq foydalanishingiz mumkin!',
        { 
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        }
      );
      
      // Asosiy menyuni ko'rsatish
      await showMainMenu(ctx);
    } else {
      await ctx.answerCbQuery('❌ Hali kanalga a\'zo bo\'lmagansiz!', { show_alert: true });
    }
  } catch (error) {
    console.error('A\'zolik tekshirish xatosi:', error);
    await ctx.answerCbQuery('❌ Xatolik yuz berdi!', { show_alert: true });
  }
});

// /start – ASOSIY MENU
bot.start(async (ctx) => {
  addUser(ctx.from);
  
  try {
    const userId = ctx.from.id;
    const member = await ctx.telegram.getChatMember(CHANNEL_CHAT_ID, userId);
    
    if (['member', 'administrator', 'creator'].includes(member.status)) {
      await showMainMenu(ctx);
    } else {
      await ctx.reply(
        `⚠️ <b>Botdan foydalanish uchun kanalimizga a'zo bo'ling!</b>\n\n` +
        `Quyidagi kanalga obuna bo'ling va "✅ Tekshirish" tugmasini bosing:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 Kanalga Qoʻshilish', url: `https://t.me/${CHANNEL_USERNAME.substring(1)}` }],
              [{ text: '✅ Tekshirish', callback_data: 'check_membership' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Start handler xatosi:', error);
    await showMainMenu(ctx);
  }
});

// ==================== INGLIZ TILI TESTLARI ====================
bot.action('start_quiz', startQuiz);
bot.action(['A1','A2','B1','B2','C1','C2'], selectLevel);
bot.action(/ans_[A-D]/, handleAnswer);
bot.action(['next_question','pause_quiz','restart_quiz'], handleAnswer);

// ==================== READING TESTLARI ====================
bot.action('start_reading', startReadingTest);
bot.action(/reading_(A1|A2|B1|B2|C1|C2)/, selectReadingLevel);
bot.action('start_reading_test', startSelectedReadingTest);
bot.action(/reading_ans_\d+/, (ctx) => handleReadingAnswer(ctx, parseInt(ctx.match[0].split('_')[2])));
bot.action(['reading_next','reading_restart','back_to_reading_menu','back_to_main','reading_pause'], handleReadingNavigation);

// ==================== ONA TILI TESTLARI ====================
bot.action('mother_tongue', (ctx) => {
  ctx.answerCbQuery();
  const kb = topics.map((t, i) => [Markup.button.callback(t, `mother_topic_${i}`)]);
  ctx.editMessageText?.('📚 Ona tili testlari – mavzuni tanlang:', { reply_markup: { inline_keyboard: kb } })
    || ctx.reply('📚 Ona tili testlari – mavzuni tanlang:', { reply_markup: { inline_keyboard: kb } });
});

bot.action(/mother_topic_(\d+)/, (ctx) => {
  const id = parseInt(ctx.match[1]);
  ctx.answerCbQuery('🚀 Boshlandi!');
  startMotherQuiz(ctx, id);
});

bot.action(/mother_ans_\d+/, handleMotherAnswer);
bot.action('end_mother_quiz', handleEndQuiz);

// ==================== REYTING ====================
bot.action('show_top', async (ctx) => {
  ctx.answerCbQuery();
  const top = await getLeaderboard();
  let text = top.length === 0 ? '🏆 Hozircha reyting boʻsh' : '🏆 TOP-10 ONA TILI BILIMDONLARI\n\n';
  top.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
    text += `${medal} <a href="tg://user?id=${u.id}">${u.first_name}</a> — ${u.bestScore}/20\n`;
  });
  text += '\n🔄 /top – yangilash';
  ctx.editMessageText?.(text, { parse_mode: 'HTML', disable_web_page_preview: true })
    || ctx.reply(text, { parse_mode: 'HTML', disable_web_page_preview: true });
});

bot.command('top', async (ctx) => {
  const top = await getLeaderboard();
  let text = top.length === 0 ? '🏆 Reyting boʻsh' : '🏆 TOP-10 ONA TILI BILIMDONLARI\n\n';
  top.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
    text += `${medal} <a href="tg://user?id=${u.id}">${u.first_name}</a> — ${u.bestScore}/20\n`;
  });
  ctx.reply(text, { parse_mode: 'HTML', disable_web_page_preview: true });
});

// ==================== BROADCAST – HAMMA ODAMGA BORADI! ====================
bot.command('broadcast', async (ctx) => {
  // Check admin rights
  if (ctx.from.id !== 6464089189) return ctx.reply('❌ Ruxsat yo\'q!');

  const text = ctx.message.text.replace('/broadcast', '').trim();
  if (!text) return ctx.reply('📝 Iltimos, xabar matnini yozing:\n/broadcast Salom hammaga!');

  const users = getStats().users;
  if (users.length === 0) return ctx.reply('ℹ️ Hozircha foydalanuvchilar mavjud emas');

  const statusMsg = await ctx.reply(`📤 Xabar yuborish boshlandi...\nJami: ${users.length} ta foydalanuvchi\nYuborildi: 0 ta\nBloklagan: 0 ta\nXatolar: 0 ta`);
  const startTime = Date.now();

  let sent = 0, blocked = 0, errors = 0;
  const batchSize = 20;
  const delay = 1000;

  try {
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      // Update status
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.ceil(((users.length - i) / batchSize) * (elapsed / (i / batchSize + 1)));
      
      await ctx.telegram.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        undefined,
        `📤 Xabar yuborilmoqda...\n` +
        `🔄 Jarayon: ${Math.min(i + batchSize, users.length)}/${users.length} (${Math.round(((i + batchSize) / users.length) * 100)}%)\n` +
        `✅ Yuborildi: ${sent} ta\n` +
        `❌ Bloklagan: ${blocked} ta\n` +
        `⚠️ Xatolar: ${errors} ta\n` +
        `⏳ Qolgan vaqt: ${remaining > 0 ? remaining + ' soniya' : 'tez orada'}`,
        { parse_mode: 'Markdown' }
      );

      // Process batch
      const results = await Promise.allSettled(
        batch.map(user => 
          bot.telegram.sendMessage(
            user.id,
            `📢 *E'lon*\\n\\n${text}\\n\\n_📅 ${new Date().toLocaleString('uz\\-UZ')}_`,
            { parse_mode: 'MarkdownV2' }
          )
          .then(() => 'sent')
          .catch(e => {
            if (e.response && e.response.error_code === 403) return 'blocked';
            console.error(`Xabar yuborishda xatolik (${user.id}):`, e.message);
            return 'error';
          })
        )
      );

      // Update counters
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') sent++;
          else if (result.value === 'blocked') blocked++;
          else errors++;
        } else {
          errors++;
        }
      });

      // Add delay between batches
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Final status
    await ctx.telegram.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      undefined,
      `✅ Xabar yuborish yakunlandi!\n\n` +
      `📊 Natijalar:\n` +
      `• Jami: ${users.length} ta\n` +
      `• Yuborildi: ${sent} ta\n` +
      `• Bloklagan: ${blocked} ta\n` +
      `• Xatolar: ${errors} ta`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('Broadcast xatosi:', error);  
    await ctx.telegram.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      undefined,
      `❌ Xabar yuborishda xatolik yuz berdi: ${error.message}\n\n` +
      `📊 Joriy holat:\n` +
      `• Yuborildi: ${sent} ta\n` +
      `• Bloklagan: ${blocked} ta\n` +
      `• Xatolar: ${errors} ta\n\n` +
      `Iltimos, qaytadan urinib ko'ring.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// BOTNI ISHGA TUSHIRISH
bot.launch();
console.log('🤖 BOT 100% ISHLAYDI! Ona tili + Ingliz tili + Reyting – hammasi tayyor!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));