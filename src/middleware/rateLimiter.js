/**
 * 频率限制中间件
 * 使用express-rate-limit库防止API被恶意调用
 */
const rateLimit = require('express-rate-limit');

/**
 * 创建频率限制中间件
 * @param {Object} options - 配置选项
 * @param {number} options.windowMs - 时间窗口，单位毫秒，默认60秒
 * @param {number} options.max - 在windowMs内允许的最大请求数，默认10次
 * @returns {Function} 配置好的rate limiter中间件
 */
const rateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 10,
    message: '请求过于频繁，请稍后再试',
    standardHeaders: true
  });
};

module.exports = rateLimiter;