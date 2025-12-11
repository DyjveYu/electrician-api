const Joi = require('joi');

const messageSchemas = {
  // 获取消息列表
  getMessages: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      type: Joi.string().valid('order', 'system').allow('').default('')
    })
  },

  // 获取消息详情
  getMessageDetail: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  },

  // 标记已读
  markAsRead: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  }
};

module.exports = messageSchemas;