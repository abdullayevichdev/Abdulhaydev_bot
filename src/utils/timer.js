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

// Function to clean up timer resources
const cleanupTimer = (ctx) => {
  if (!ctx.session) return;
  
  // Clear any existing interval
  if (ctx.session.timer?.interval) {
    clearInterval(ctx.session.timer.interval);
    ctx.session.timer.interval = null;
  }
  
  // Clear any existing timeout
  if (ctx.session.timer?.timeout) {
    clearTimeout(ctx.session.timer.timeout);
    ctx.session.timer.timeout = null;
  }
  
  // Clean up timer reference
  if (ctx.session.timer) {
    delete ctx.session.timer;
  }
};


/**
 * Starts a timer for the current question
 * @param {Object} ctx - Telegraf context
 * @param {Object} question - Current question object
 * @param {Object} timerMsg - Timer message object
 * @param {number} [duration] - Optional custom duration in seconds
 */
const startTimer = (ctx, question, timerMsg, duration = DEFAULT_QUIZ_TIMER) => {
  // Clean up any existing timers first
  cleanupTimer(ctx);
  // Clear any existing timers first
  stopTimer(ctx);
  
  // Initialize session if not exists
  if (!ctx.session) {
    ctx.session = {};
  }
  
  // Store timer data in session
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  
  // Create timer data
  const timerData = {
    startTime,
    endTime,
    duration,
    interval: null,
    timeout: null,
    messageId: timerMsg.message_id,
    chatId: timerMsg.chat.id
  };
  
  // Store the timer data in the session
  ctx.session.timer = timerData;
  
  // Function to update the timer display
    const updateTimer = async () => {
    try {
      if (!ctx.session?.timer) return;
      
      const now = Date.now();
      let remaining = Math.ceil((endTime - now) / 1000);
      
      // Ensure remaining is not negative
      remaining = Math.max(0, remaining);
      
      // Only update if time has changed or it's the first run
      if (ctx.session.lastRemaining !== remaining) {
        ctx.session.lastRemaining = remaining;
        
        // Update the timer message
        try {
          await ctx.telegram.editMessageText(
            timerMsg.chat.id,
            timerMsg.message_id,
            undefined,
            getTimerText(remaining, duration),
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          // Ignore message not modified errors
          if (!error.message.includes('message is not modified')) {
            throw error;
          }
        }
      }
      
      // If time's up, clear the interval and move to next question
      if (remaining <= 0) {
        stopTimer(ctx);
        if (onTimeUpCallback) {
          try {
            // Delete the question message
            if (ctx.session.questionMessageId) {
              try {
                await ctx.telegram.deleteMessage(
                  ctx.chat.id, 
                  ctx.session.questionMessageId
                );
              } catch (e) {}
              delete ctx.session.questionMessageId;
            }
            // Delete the timer message
            if (ctx.session.timerMessageId) {
              try {
                await ctx.telegram.deleteMessage(
                  ctx.chat.id,
                  ctx.session.timerMessageId
                );
              } catch (e) {}
              delete ctx.session.timerMessageId;
            }
            
            await onTimeUpCallback(ctx);
          } catch (error) {
            console.error('Error in time up callback:', error);
          }
        }
      }
    } catch (error) {
      console.error('Timer update error:', error);
      stopTimer(ctx);
    }
  };
  
  // Initial update
  updateTimer();
  
  // Update every second
  timerData.interval = setInterval(updateTimer, 1000);
  
  // Set timeout for when the timer ends
  timerData.timeout = setTimeout(() => {
    stopTimer(ctx);
    if (onTimeUpCallback) {
      onTimeUpCallback(ctx);
    }
  }, duration * 1000);
  
  // Store the interval and timeout in the timer data
  ctx.session.timer = timerData;
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
      // Import the quiz controller to access nextQuestion
      const { sendQuestion } = require('../controllers/quizController');
      await sendQuestion(ctx);
    } else {
      await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
    }
  } catch (error) {
    console.error('Keyingi savolga o\'tishda xatolik:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urining /start');
  }
}

const stopTimer = (ctx) => {
  if (!ctx.session) return;
  
  // Clean up timer resources
  cleanupTimer(ctx);
  
  // Clear any existing timer references
  if (ctx.session.timerMessageId) {
    delete ctx.session.timerMessageId;
  }
  
  // Reset last remaining time
  if (ctx.session.lastRemaining !== undefined) {
    delete ctx.session.lastRemaining;
  }
};

// Function to format time text
const getTimerText = (seconds, timerDuration = 10) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const timeString = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  
  // Create a progress bar with green for remaining time and gray for elapsed
  const progress = Math.max(0, Math.min(10, Math.round((seconds / timerDuration) * 10)));
  const progressBar = '🟢'.repeat(progress) + '⚪'.repeat(10 - progress);
  
  return `⏳ <b>${timeString}</b>\n${progressBar}`;
};

module.exports = {
  startTimer,
  stopTimer,
  timeUp,
  getTimerText,
  setOnTimeUp
};
