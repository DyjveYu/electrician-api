const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    console.log('管理员认证中间件开始执行');
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('访问令牌缺失');
      return res.error('访问令牌缺失', 401);
    }

    console.log('验证JWT token...');
    // 验证JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 检查是否为管理员token
    if (decoded.type !== 'admin') {
      console.log('无效的管理员令牌类型:', decoded.type);
      return res.error('无效的管理员令牌', 401);
    }

    console.log('验证管理员身份，ID:', decoded.id);
    // 验证管理员身份
    const admins = await query(
      'SELECT id, username, status FROM admins WHERE id = ? AND status = "active"',
      [decoded.id]
    );
    
    console.log('管理员查询结果:', admins.length);
    if (admins.length === 0) {
      return res.error('管理员不存在或已被禁用', 403);
    }
    
    const admin = admins[0];
    console.log('管理员认证成功:', admin.username);

    // 将管理员信息添加到请求对象
    req.user = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('JWT验证失败:', error.message);
      return res.error('无效的访问令牌', 401);
    } else if (error.name === 'TokenExpiredError') {
      console.log('JWT已过期:', error.message);
      return res.error('访问令牌已过期', 401);
    } else {
      console.error('管理员认证中间件错误:', error);
      return res.error('认证失败', 500);
    }
  }
};

module.exports = adminAuthMiddleware;