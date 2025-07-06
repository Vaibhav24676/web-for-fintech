/**
 * Logger Service
 * 
 * Provides structured logging functionality for the application.
 * This service acts as a thin wrapper around the console to enable easy replacement
 * with a more robust logging solution in the future.
 */

// Log levels and their priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Determine the current log level based on environment
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? 'info' : 'debug';
};

// Main logging function with metadata support
const logger = (level, message, meta = {}) => {
  if (logLevels[level] <= logLevels[getLogLevel()]) {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      message,
      ...meta
    };
    console.log(JSON.stringify(logObject));
  }
};

// Export convenience methods for different log levels
export const logDebug = (message, meta) => logger('debug', message, meta);
export const logInfo = (message, meta) => logger('info', message, meta);
export const logWarn = (message, meta) => logger('warn', message, meta);
export const logError = (message, meta) => logger('error', message, meta);
export const logHttp = (message, meta) => logger('http', message, meta);
export const logDetail = (message, meta) => logger('debug', message, meta); // Alias for logDebug

export default {
  logDebug,
  logInfo,
  logWarn,
  logError,
  logHttp,
  logDetail
};
