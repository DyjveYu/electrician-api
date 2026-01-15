/**
 * 工单管理路由
 * 处理工单的创建、查询、状态更新等操作的路由配置
 */

const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const validate = require('../middleware/validation');
const { authenticateToken, requireRole } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const orderSchemas = require('../schemas/orderSchemas');

/**
 * @path /api/orders
 * @desc 创建工单
 * @access 用户
 */
router.post(
  '/',
  authenticateToken,
  requireRole(['user']),
  rateLimiter({ windowMs: 60000, max: 5 }), // 每分钟最多5次
  validate(orderSchemas.createOrder),
  OrderController.createOrder
);

/**
 * @path /api/orders
 * @desc 获取工单列表
 * @access 用户、电工
 */
router.get(
  '/',
  authenticateToken,
  requireRole(['user', 'electrician', 'admin']),
  validate(orderSchemas.getOrdersList, 'query'),
  OrderController.getOrderList
);

/**
 * @path /api/orders/:id
 * @desc 获取工单详情
 * @access 用户、电工
 */
router.get(
  '/:id',
  authenticateToken,
  requireRole(['user', 'electrician', 'admin']),
  validate(orderSchemas.getOrderDetail, 'params'),
  OrderController.getOrderDetail
);

/**
 * @path /api/orders/:id/start
 * @desc 电工开始维修
 * @access 电工
 */
router.put(
  '/:id/start',
  authenticateToken,
  requireRole(['electrician']),
  validate(orderSchemas.startOrder),
  OrderController.startOrder
);

/**
 * @path /api/orders/:id/take
 * @desc 电工抢单
 * @access 电工
 */
router.post(
  '/:id/take',
  authenticateToken,
  requireRole(['electrician']),
  rateLimiter({ windowMs: 60000, max: 10 }), // 每分钟最多10次
  OrderController.takeOrder
);

/**
 * @path /api/orders/:id/complete
 * @desc 完成工单
 * @access 电工
 */
router.post(
  '/:id/complete',
  authenticateToken,
  requireRole(['electrician']),
  validate(orderSchemas.completeOrder),
  OrderController.completeOrder
);



/**
 * @path /api/orders/:id/confirm
 * @desc 用户确认工单
 * @access 用户
 */
router.put(
  '/:id/confirm',
  authenticateToken,
  requireRole(['user']),
  validate(orderSchemas.confirmOrder),
  OrderController.confirmOrder
);

/**
 * @path /api/orders/:id/review
 * @desc 用户评价订单
 * @access 用户
 */
router.put(
  '/:id/review',
  authenticateToken,
  requireRole(['user']),
  validate(orderSchemas.reviewOrder),
  OrderController.reviewOrder
);

/**
 * @path /api/orders/:id/update
 * @desc 电工修改订单内容和金额
 * @access 电工
 */
router.put(
  '/:id/update',
  authenticateToken,
  requireRole(['electrician']),
  validate(orderSchemas.updateOrderByElectrician),
  OrderController.updateOrderByElectrician
);

/**
 * @path /api/orders/:id/confirm-update
 * @desc 用户确认订单修改
 * @access 用户
 */
router.post(
  '/:id/confirm-update',
  authenticateToken,
  requireRole(['user']),
  OrderController.confirmOrderUpdate
);

/**
 * @path /api/orders/:id/initiate-cancel
 * @desc 发起取消订单请求
 * @access 用户、电工
 */
router.post(
  '/:id/initiate-cancel',
  authenticateToken,
  requireRole(['user', 'electrician']),
  validate(orderSchemas.initiateCancelOrder),
  OrderController.initiateCancelOrder
);

/**
 * @path /api/orders/:id/confirm-cancel
 * @desc 确认取消订单
 * @access 用户、电工
 */
router.post(
  '/:id/confirm-cancel',
  authenticateToken,
  requireRole(['user', 'electrician']),
  validate(orderSchemas.confirmCancelOrder),
  OrderController.confirmCancelOrder
);

module.exports = router;/**
 * @path /api/orders/:id/cancel
 * @desc 取消工单
 * @access 用户、电工
 */
router.put(
  '/:id/cancel',
  authenticateToken,
  requireRole(['user', 'electrician']),
  validate(orderSchemas.cancelOrder),
  OrderController.cancelOrder
);