/**
 * 支付路由
 * 定义支付创建、查询、回调等API端点
 */

const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const validate = require('../middleware/validation');
const schemas = validate.schemas;
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// 创建支付订单 - 限流：每分钟最多5次
router.post('/',
  rateLimiter('create_payment', 5, 60),
  authenticateToken,
  validate(schemas.createPayment),
  PaymentController.createPayment
);

// 测试支付确认
router.post('/test/confirm',
  authenticateToken,
  validate(schemas.confirmTestPayment),
  PaymentController.confirmTestPayment
);

// 微信支付回调（无需认证）
router.post('/wechat/notify',
  PaymentController.wechatNotify
);

// 查询支付状态
router.get('/:payment_no',
  authenticateToken,
  validate(schemas.queryPayment, 'params'),
  PaymentController.queryPayment
);

// 获取支付列表
router.get('/',
  authenticateToken,
  validate(schemas.getPaymentList, 'query'),
  PaymentController.getPaymentList
);

// 获取支付统计
router.get('/stats/summary',
  authenticateToken,
  PaymentController.getPaymentStats
);

// 申请退款
router.post('/:payment_no/refund',
  authenticateToken,
  validate(schemas.requestRefund),
  PaymentController.requestRefund
);

// 处理退款（管理员用）
router.put('/:payment_no/refund',
  authenticateToken,
  // requireRole('admin'), // 暂时注释，后续添加管理员认证
  validate(schemas.processRefund),
  PaymentController.processRefund
);

module.exports = router;