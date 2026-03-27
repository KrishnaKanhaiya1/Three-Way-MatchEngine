import logger from '../utils/logger.js';

// Global error handler
const errorHandler = (err, _req, res, _next) => {
  logger.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File size exceeds the 20 MB limit.' });
  }

  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: 'Validation Error', details: messages });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: `Invalid ${err.path}: ${err.value}` });
  }

  const message = String(err.message || '');
  if (message.includes('[429 Too Many Requests]') || message.includes('rate limit')) {
    return res.status(503).json({
      success: false,
      error: 'Extraction temporarily unavailable due to Gemini rate limits.',
      details: 'Retry later or use an API key/project with available quota.',
    });
  }

  if (message.includes('Gemini') || message.includes('extraction') || message.includes('Failed to extract')) {
    return res.status(422).json({ success: false, error: 'Document Extraction Failed', details: message });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
};

export default errorHandler;
