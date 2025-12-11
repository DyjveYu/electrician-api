/**
 * 自定义错误类
 * 用于统一处理业务逻辑错误
 */
class AppError extends Error {
  /**
   * 创建自定义错误实例
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码，默认400
   * @param {object} data - 额外数据，默认空对象
   */
  constructor(message, statusCode = 400, data = {}) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;