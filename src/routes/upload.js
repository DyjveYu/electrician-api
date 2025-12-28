const express = require('express');
const router = express.Router();
const UploadController = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

console.log('🔄 [Routes] 加载上传路由模块 (upload.js)');

// 获取上传中间件
const uploadAvatar = UploadController.getUploadMiddleware();
const uploadCertification = UploadController.getCertificationUploadMiddleware();

/**
 * @swagger
 * /api/upload/avatar:
 *   post:
 *     summary: 上传用户头像
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: 头像文件 (支持 JPEG、PNG、GIF，最大5MB)
 *     responses:
 *       200:
 *         description: 头像上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: 头像上传成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: /uploads/avatars/avatar_abc123.jpg
 *                     filename:
 *                       type: string
 *                       example: avatar_abc123.jpg
 *                     originalName:
 *                       type: string
 *                       example: my_avatar.jpg
 *                     size:
 *                       type: integer
 *                       example: 102400
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       413:
 *         description: 文件过大
 */
router.post('/avatar', authenticateToken, (req, res) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.error('文件大小不能超过5MB', 413);
      }
      return res.error(err.message || '上传失败', 400);
    }
    UploadController.uploadAvatar(req, res);
  });
});

/**
 * @swagger
 * /api/upload/certification:
 *   post:
 *     summary: 上传认证证件
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               certification:
 *                 type: string
 *                 format: binary
 *                 description: 证件图片
 *     responses:
 *       200:
 *         description: 上传成功
 */
router.post('/certification', authenticateToken, (req, res) => {
  console.log('📥 收到证件上传请求:', req.originalUrl);
  uploadCertification.single('certification')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.error('文件大小不能超过10MB', 413);
      }
      return res.error(err.message || '上传失败', 400);
    }
    UploadController.uploadCertification(req, res);
  });
});

module.exports = router;