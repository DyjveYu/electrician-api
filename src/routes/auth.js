/**
 * 用户认证路由
 * 定义用户登录、注册、角色切换等API端点
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
// 错误导入：const { validate } = require('../middleware/validation');
const validate = require('../middleware/validation');
const userSchemas = require('../schemas/userSchemas');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// 发送验证码 - 限流：每分钟最多5次
router.post(
  '/send-code',
  rateLimiter(),
  validate(userSchemas.sendCode),
  AuthController.sendCode
);

// 微信小程序 code2session
router.post('/code2session',
  rateLimiter(),
  AuthController.code2Session
);

// 用户登录/注册 - 限流：每分钟最多10次
router.post('/login',
  rateLimiter(),
  validate(userSchemas.login),
  AuthController.login
);

// 获取用户信息
router.get('/userinfo',
  authenticateToken,
  AuthController.getUserInfo
);

// 更新用户信息
router.put('/profile',
  authenticateToken,
  validate(userSchemas.updateProfile),
  AuthController.updateProfile
);

// 切换用户角色
router.post('/switch-role',
  authenticateToken,
  validate(userSchemas.switchRole),
  AuthController.switchRole
);

// 刷新token
router.post('/refresh-token',
  authenticateToken,
  AuthController.refreshToken
);

// 用户登出
router.post('/logout',
  authenticateToken,
  AuthController.logout
);

// 验证token
router.get('/verify-token',
  authenticateToken,
  AuthController.verifyToken
);

module.exports = router;