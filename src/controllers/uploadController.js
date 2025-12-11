/**
 * 文件上传控制器
 * 处理文件上传相关的业务逻辑
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class UploadController {
  // 配置multer存储
  static getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/avatars');
        // 确保目录存在
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        // 生成唯一文件名
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${uniqueSuffix}${ext}`);
      }
    });
  }

  // 文件过滤器
  static fileFilter(req, file, cb) {
    // 只允许图片文件
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPEG、PNG、GIF 格式的图片'), false);
    }
  }

  // 配置multer
  static getUploadMiddleware() {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
      }
    });
  }

  // 上传头像
  static async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.error('请选择要上传的图片', 400);
      }

      // 构建文件URL
      const fileUrl = `/uploads/avatars/${req.file.filename}`;
      
      res.success({
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }, '头像上传成功');
    } catch (error) {
      console.error('上传头像错误:', error);
      res.error('上传失败');
    }
  }

  // 上传通用文件
  static async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.error('请选择要上传的文件', 400);
      }

      // 构建文件URL
      const fileUrl = `/uploads/${req.file.filename}`;
      
      res.success({
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }, '文件上传成功');
    } catch (error) {
      console.error('上传文件错误:', error);
      res.error('上传失败');
    }
  }
}

module.exports = UploadController;