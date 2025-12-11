/**
 * 全局错误处理中间件
 */

module.exports = (err, req, res, next) => {
  console.error('Error:', err);

  // Joi验证错误
  if (err.isJoi) {
    return res.error(err.details[0].message, 422);
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.error('无效的token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return res.error('token已过期', 401);
  }

  // MySQL错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.error('数据已存在', 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.error('关联数据不存在', 400);
  }

  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.error('文件大小超出限制', 400);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.error('文件数量超出限制', 400);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.error('不支持的文件类型', 400);
  }

  // 自定义业务错误
  // 兼容 AppError 等使用 statusCode 的错误类
  if (typeof err.statusCode === 'number') {
    return res.error(err.message, err.statusCode, err.data || {});
  }

  // 兼容使用 status 的错误对象
  if (typeof err.status === 'number') {
    return res.error(err.message, err.status);
  }

  // 默认服务器错误
  res.error('服务器内部错误', 500);
};