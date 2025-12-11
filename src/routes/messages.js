const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
const schemas = require('../schemas/messageSchemas');

// 获取用户消息列表
router.get('/',
  authenticateToken,
  validate(schemas.getMessages, 'query'),
  MessageController.getMessages
);

// 获取消息详情
router.get('/:id',
  authenticateToken,
  validate(schemas.getMessageDetail, 'params'),
  MessageController.getMessageDetail
);

// 标记消息为已读
router.put('/:id/read',
  authenticateToken,
  validate(schemas.markAsRead, 'params'),
  MessageController.markAsRead
);

// 获取未读消息数量
router.get('/unread/count',
  authenticateToken,
  MessageController.getUnreadCount
);

module.exports = router;