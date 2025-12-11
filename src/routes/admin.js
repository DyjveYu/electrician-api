const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

// 测试路由
router.get('/', (req, res) => {
  res.success({ message: 'Admin API is working' });
});

// 数据库测试路由（无需认证）
router.get('/test-db', async (req, res) => {
  try {
    console.log('开始测试数据库连接...');
    const { query } = require('../../config/database');
    
    console.log('执行简单查询...');
    const result = await query('SELECT COUNT(*) as count FROM users LIMIT 1');
    console.log('查询结果:', result);
    
    res.success({ 
      message: '数据库连接正常',
      userCount: result[0].count 
    });
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.error('数据库连接失败: ' + error.message);
  }
});

// 简化用户列表测试（无需认证）
router.get('/test-users', async (req, res) => {
  try {
    console.log('开始测试用户查询...');
    const { query } = require('../../config/database');
    
    const users = await query('SELECT id, phone, nickname FROM users LIMIT 3');
    console.log('用户查询结果:', users.length);
    
    res.success({ 
      message: '用户查询成功',
      users: users 
    });
  } catch (error) {
    console.error('用户查询测试失败:', error);
    res.error('用户查询失败: ' + error.message);
  }
});

// 管理员登录
router.post('/auth/login', adminController.login);

// 获取管理员信息
router.get('/auth/info', adminAuthMiddleware, adminController.getAdminInfo);

// 管理员登出
router.post('/logout', adminAuthMiddleware, adminController.logout);

// 用户管理
router.get('/users', adminAuthMiddleware, adminController.getUsers);
router.get('/users/:id', adminAuthMiddleware, adminController.getUserDetail);
router.put('/users/:id/status', adminAuthMiddleware, adminController.toggleUserStatus);

// 电工管理
router.get('/electricians', adminAuthMiddleware, adminController.getElectricians);
router.get('/electricians/:id', adminAuthMiddleware, adminController.getElectricianDetail);
router.put('/electricians/:id/review', adminAuthMiddleware, adminController.reviewElectrician);
router.put('/electricians/:id/status', adminAuthMiddleware, adminController.toggleUserStatus);

// 工单管理
router.get('/orders', adminAuthMiddleware, adminController.getOrders);
router.get('/orders/:id', adminAuthMiddleware, adminController.getOrderDetail);
router.put('/orders/:id/status', adminAuthMiddleware, adminController.updateOrderStatus);

// 数据统计
router.get('/statistics', adminAuthMiddleware, adminController.getStatistics);

// 系统通知管理
router.get('/messages', adminAuthMiddleware, adminController.getMessages);
router.post('/messages', adminAuthMiddleware, adminController.createMessage);
router.get('/messages/:id', adminAuthMiddleware, adminController.getMessageDetail);
router.put('/messages/:id', adminAuthMiddleware, adminController.updateMessage);
router.delete('/messages/:id', adminAuthMiddleware, adminController.deleteMessage);

module.exports = router;