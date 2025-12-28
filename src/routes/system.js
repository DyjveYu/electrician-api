/**
 * 系统路由
 * 定义服务类型、系统配置、文件上传等API端点
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const SystemController = require('../controllers/systemController');
const validate = require('../middleware/validation');
const schemas = validate.schemas;
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    // 允许的文件类型
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 获取服务类型列表（公开接口）
router.get('/service-types',
  SystemController.getServiceTypes
);

// 获取服务类型详情（公开接口）
router.get('/service-types/:id',
  validate(schemas.getServiceTypeDetail),
  SystemController.getServiceTypeDetail
);

// 获取服务类型统计
router.get('/service-types/stats/summary',
  authenticateToken,
  SystemController.getServiceTypeStats
);

// 获取系统配置（公开接口）
router.get('/config',
  validate(schemas.getSystemConfig),
  SystemController.getSystemConfig
);

// 获取应用信息（公开接口）
router.get('/app-info',
  SystemController.getAppInfo
);

// 文件上传 - 限流：每分钟最多10次
router.post('/upload',
  rateLimiter(),
  authenticateToken,
  upload.single('file'),
  SystemController.uploadFile
);

// 获取附近的电工
router.get('/nearby-electricians',
  optionalAuth,
  validate(schemas.getNearbyElectricians),
  SystemController.getNearbyElectricians
);

// 搜索功能
router.get('/search',
  optionalAuth,
  validate(schemas.search),
  SystemController.search
);

// 获取平台统计数据（公开接口）
router.get('/stats',
  SystemController.getPlatformStats
);

// 调试：检查文件是否存在（仅用于调试）
router.get('/check-file', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.error('缺少path参数');

  // 防止路径遍历攻击（简单防御）
  if (filePath.includes('..') && !filePath.includes('uploads')) {
    return res.error('非法路径');
  }

  const absolutePath = path.join(__dirname, '../../', filePath.startsWith('/') ? filePath.substring(1) : filePath);

  const fs = require('fs');
  const exists = fs.existsSync(absolutePath);

  res.success({
    exists,
    queryPath: filePath,
    resolvedPath: absolutePath,
    cwd: process.cwd(),
    __dirname: __dirname
  });
});

module.exports = router;