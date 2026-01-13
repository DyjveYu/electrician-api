/**
 * JWT认证中间件
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const redis = require('../config/redis');

/**
 * 验证JWT token
 */
const authenticateToken = async (req, res, next) => {
  // ⭐ 临时：允许查询接口跳过认证
  if (req.path === '/withdrawal/status') {
    console.log('[认证中间件] ⚠️ 临时跳过认证（仅测试）');
    // 模拟一个用户
    req.user = { id: 53 }; // ⭐ 使用你的实际用户ID
    return next();
  }
  try {
    // ⭐ 添加详细日志
    console.log('============2026.1.12认证中间件============');
    console.log('[认证中间件] 开始验证');
    console.log('[认证中间件] 请求路径:', req.path);
    console.log('[认证中间件] Authorization header:', req.headers.authorization);
    console.log('[认证中间件] 所有 headers:', JSON.stringify(req.headers, null, 2));


    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.error('未提供访问令牌', 401);
    }

    // 检查token是否在黑名单中（如果Redis连接失败则跳过）
    try {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token已失效，请重新登录'
        });
      }
    } catch (redisError) {
      console.warn('Redis连接失败，跳过黑名单检查:', redisError.message);
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT decoded payload:', JSON.stringify(decoded, null, 2));
    console.log('decoded.id:', decoded.id, 'typeof:', typeof decoded.id);

    // 获取用户信息
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户状态
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用'
      });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.error('无效的访问令牌', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return res.error('访问令牌已过期', 401);
    }
    next(error);
  }
};

/**
 * 验证用户角色
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.error('未认证用户', 401);
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];

    if (!userRoles.includes(req.user.current_role)) {
      return res.error('权限不足', 403);
    }

    next();
  };
};

/**
 * 验证电工认证状态
 */
const requireElectricianCertification = (req, res, next) => {
  if (!req.user) {
    return res.error('未认证用户', 401);
  }

  if (!req.user.can_be_electrician) {
    return res.error('需要完成电工认证', 403);
  }

  next();
};

/**
 * 可选认证（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // 忽略token错误，继续执行
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireElectricianCertification,
  optionalAuth
};