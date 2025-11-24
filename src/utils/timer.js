const { getCorrectIndex } = require('./helpers');

// Default timer durations (in seconds)
const DEFAULT_QUIZ_TIMER = 10; // 10 seconds for regular quiz
const READING_TIMER = 30; // 30 seconds for reading tests

// This will be called when the timer runs out
let onTimeUpCallback = null;

// Function to set the callback for when time is up
const setOnTimeUp = (callback) => {
  onTimeUpCallback = callback;
};

/**
 * Starts a timer for the current question
 * @param {Object} ctx - Telegraf context
 * @param {Object} question - Current question object
 * @param {Object} timerMsg - Timer message object
 * @param {number} [duration] - Optional custom duration in seconds
 */
const startTimer = (ctx, question, timerMsg, duration) => {
  // Determine duration based on test type or use provided duration
  const timerDuration = duration || 
    (ctx.session.testType === 'reading' ? READING_TIMER : DEFAULT_QUIZ_TIMER);
  // Clear any existing timers first
  stopTimer(ctx);
  
  // Store timer data in session
  const startTime = Date.now();
  const endTime = startTime + (timerDuration * 1000);
  
  // Create a reference to the interval so we can clear it
  const timerData = {
    startTime,
    endTime,
    interval: null,
    timeout: null
  };
  
  // Update the timer immediately
  updateTimer();
  
  // Set up the interval for updating the timer display
  timerData.interval = setInterval(updateTimer, 500); // Update twice per second for smoother display
  
  // Set up the timeout for when the timer ends
  timerData.timeout = setTimeout(() => {
    stopTimer(ctx);
    timeUp(ctx, question, timerMsg);
  }, TIMER_DURATION * 1000);
  
  // Store the timer data in the session
  if (!ctx.session) ctx.session = {};
  ctx.session.timer = timerData;
  
  async function updateTimer() {
    try {
      if (!ctx || !ctx.session || !ctx.session.timer) return;
      
      const now = Date.now();
      const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));
      
      if (timeLeft <= 0) {
        stopTimer(ctx);
        await timeUp(ctx, question, timerMsg);
        return;
      }
      
      await updateTimerDisplay(timeLeft);
    } catch (error) {
      console.error('Xatolik vaqtni yangilashda:', error);
      stopTimer(ctx);
    }
  }
  
  async function updateTimerDisplay(seconds) {
    try {
      if (!ctx || !ctx.chat || !timerMsg) return;
      
      const newText = getTimerText(seconds);
      
      // Skip if message content is the same
      if (ctx.session.lastTimerText === newText) {
        return;
      }
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        timerMsg.message_id,
        null,
        newText,
        { parse_mode: 'HTML' }
      );
      
      // Store the last displayed text
      ctx.session.lastTimerText = newText;
    } catch (error) {
      // Ignore "message not modified" and "chat not found" errors
      if (!error.message.includes('message is not modified') && 
          !error.message.includes('chat not found')) {
        console.error('Xatolik vaqtni ko\'rsatishda:', error);
      }
    }
  }
};

async function timeUp(ctx, question, timerMsg) {
  // Clear any existing timer first
  if (ctx.session.timer) {
    if (ctx.session.timer.interval) {
      clearInterval(ctx.session.timer.interval);
      ctx.session.timer.interval = null;
    }
    if (ctx.session.timer.timeout) {
      clearTimeout(ctx.session.timer.timeout);
      ctx.session.timer.timeout = null;
    }
    delete ctx.session.timer;
  }
  
  try {
    // Delete the timer message if it exists
    if (ctx.session.timerMessageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.timerMessageId);
      } catch (e) {
        console.error('Error deleting timer message:', e);
      }
      delete ctx.session.timerMessageId;
    }
    
    // Delete the question message if it exists
    if (ctx.session.questionMessageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.questionMessageId);
      } catch (e) {
        console.error('Error deleting question message:', e);
      }
      delete ctx.session.questionMessageId;
    }
    
    // Proceed to next question
    if (onTimeUpCallback) {
      await onTimeUpCallback(ctx);
    }
    
  } catch (error) {
    console.error('Error in timeUp:', error);
    if (onTimeUpCallback) {
      try {
        await onTimeUpCallback(ctx);
      } catch (e) {
        console.error('Error in next question callback:', e);
      }
    }
  }
}

async function proceedToNextQuestion(ctx) {
  try {
    if (ctx.session.autoNextTimeout) {
      clearTimeout(ctx.session.autoNextTimeout);
      delete ctx.session.autoNextTimeout;
    }
    
    delete ctx.session.waitingForNext;
    
    if (ctx.session) {
      ctx.session.questionIndex = (ctx.session.questionIndex || 0) + 1;
      await nextQuestion(ctx);
    } else {
      await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
    }
  } catch (error) {
    console.error('Keyingi savolga o\'tishda xatolik:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
  }
}

const stopTimer = (ctx) => {
  try {
    // Check if session exists and has a timer
    if (!ctx || !ctx.session || !ctx.session.timer) return;
    
    const timer = ctx.session.timer;
    
    // Clear the interval if it exists
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }
    
    // Clear the timeout if it exists
    if (timer.timeout) {
      clearTimeout(timer.timeout);
      timer.timeout = null;
    }
    
    // Clean up the timer data
    delete ctx.session.timer;
    
  } catch (error) {
    console.error('Xatolik taymerni to\'xtatishda:', error);
    // If there's an error, try to clean up as much as possible
    if (ctx && ctx.session) {
      delete ctx.session.timer;
    }
  }
};

const getTimerText = (seconds) => {
  if (seconds <= 0) {
    return "⏰ Vaqt tugadi!";
  }
  
  // Calculate progress (0 to 1)
  const progress = Math.min(1, seconds / TIMER_DURATION);
  const filledCount = Math.round(progress * 10);
  
  // Create progress bar
  const filled = '🟩'.repeat(filledCount);
  const empty = '⬜'.repeat(10 - filledCount);
  
  // Add extra space after the timer text to ensure consistent width
  const timerText = `⏰ Vaqt: ${seconds < 10 ? ' ' : ''}${seconds} sekund qoldi`;
  
  return `<b>${timerText}</b>\n${filled}${empty}`;
};

module.exports = {
  startTimer,
  stopTimer,
  timeUp,
  getTimerText,
  setOnTimeUp
};
