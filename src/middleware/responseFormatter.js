/**
 * 响应格式化中间件
 * 统一API响应格式
 */

module.exports = (req, res, next) => {
  // 成功响应
  res.success = (data = {}, message = 'success') => {
    console.log('res.success 被调用，接收的参数:');
    console.log('- data:', JSON.stringify(data));
    console.log('- message:', message);

    const response = {
      code: 200,
      message,
      data,
      timestamp: Date.now()
    };

    console.log('准备发送的完整响应:', JSON.stringify(response));

    res.json(response);
  };

  // 错误响应
  res.error = (message = 'Internal Server Error', code = 500, data = {}) => {
    res.status(code).json({
      code,
      message,
      data,
      timestamp: Date.now()
    });
  };

  // 分页响应
  res.paginate = (list = [], total = 0, page = 1, limit = 10, message = 'success') => {
    res.json({
      code: 200,
      message,
      data: {
        list,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      timestamp: Date.now()
    });
  };

  next();
};