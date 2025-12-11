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

/**
 * @route POST /api/electricians/certification
 * @desc 提交电工认证申请
 * @access Private
 */
router.post(
  '/certification',
  authenticateToken,
  rateLimiter({ max: 5, windowMs: 60000 }),
  validate(electricianCertificationSchema),
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

module.exports = router;