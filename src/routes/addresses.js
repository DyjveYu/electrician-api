/**
 * 地址管理路由
 * 定义地址增删改查、设置默认地址、获取地区数据等API端点
 */

const express = require('express');
const router = express.Router();
const AddressController = require('../controllers/addressController');
const { authenticateToken } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// 获取用户地址列表
router.get('/',
  authenticateToken,
  AddressController.getAddresses
);

// 获取用户默认地址
router.get('/default',
  authenticateToken,
  AddressController.getDefaultAddress
);

// 获取地区数据（省市区三级联动）
router.get('/regions/list',
  AddressController.getRegions
);

// 获取地址详情
router.get('/:id',
  authenticateToken,
  AddressController.getAddressDetail
);

// 创建新地址 - 限流：每分钟最多20次
router.post('/',
  rateLimiter({ max: 20 }),
  authenticateToken,
  AddressController.createAddress
);

// 更新地址信息 - 限流：每分钟最多30次
router.put('/:id',
  rateLimiter({ max: 30 }),
  authenticateToken,
  AddressController.updateAddress
);

// 设置默认地址 - 限流：每分钟最多10次
router.put('/:id/default',
  rateLimiter({ max: 10 }),
  authenticateToken,
  AddressController.setDefaultAddress
);

// 删除地址 - 限流：每分钟最多10次
router.delete('/:id',
  rateLimiter({ max: 10 }),
  authenticateToken,
  AddressController.deleteAddress
);

module.exports = router;