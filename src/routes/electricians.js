/**
 * 电工认证路由
 * 处理电工认证申请和状态查询
 */

const express = require('express');
const router = express.Router();
const ElectricianController = require('../controllers/electricianController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { electricianCertificationSchema } = require('../schemas/electricianSchemas');
const rateLimiter = require('../middleware/rateLimiter');
const authMiddleware = require('../middleware/auth'); // ⭐ 必须引入
/**
 * @route POST /api/electricians/certification
 * @desc 提交电工认证申请
 * @access Private
 */
router.post(
  '/certification',
  (req, res, next) => {
    console.log('📍 路由: POST /api/electricians/certification');
    console.log('请求头:', req.headers.authorization ? '有Token' : '无Token');
    next();
  },
  authenticateToken,
  (req, res, next) => {
    console.log('✅ Token验证通过，用户ID:', req.user?.id);
    next();
  },
  rateLimiter({ max: 5, windowMs: 60000 }),
  (req, res, next) => {
    console.log('✅ 限流检查通过');
    next();
  },
  validate(electricianCertificationSchema),
  (req, res, next) => {
    console.log('✅ 数据验证通过');
    next();
  },
  ElectricianController.submitCertification
);

/**
 * @route GET /api/electricians/certification/status
 * @desc 获取电工认证状态
 * @access Private
 */
router.get(
  '/certification/status',
  authenticateToken,
  ElectricianController.getCertificationStatus
);

/**
 * @route GET /api/electricians/income
 * @desc 获取电工收入详情
 * @access Private (Electrician only)
 */
router.get(
  '/income',
  authenticateToken,
  ElectricianController.getIncome
);

/**
 * @route POST /api/electricians/withdraw
 * @desc 电工申请提现
 * @access Private (Electrician only)
 */
router.post(
  '/withdraw',
  authenticateToken,
  rateLimiter({ max: 3, windowMs: 5 * 60 * 1000 }), // 5分钟最多提现5次
  ElectricianController.withdraw
);

/**
 * @route GET /api/electricians/withdrawals
 * @desc 获取提现记录列表
 * @access Private (Electrician only)
 */
router.get(
  '/withdrawals',
  authenticateToken,
  ElectricianController.getWithdrawals
);

/**
 * @route POST /api/electricians/withdrawal/callback
 * @desc 微信提现结果回调
 * @access Public (微信服务器调用，无需认证)
 */
router.post(
  '/withdrawal/callback',
  ElectricianController.withdrawalCallback
);
// ⭐ 新增：查询转账单状态
router.get(
  '/withdrawal/status', 
  ElectricianController.queryWithdrawalStatus
);


module.exports = router;