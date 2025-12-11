/**
 * 工单相关的数据验证Schema
 * 使用Joi验证请求参数
 */

const Joi = require('joi');

// 创建工单Schema
const createOrder = Joi.object({
  service_type_id: Joi.number().integer().required()
    .messages({
      'any.required': '服务类型ID是必填项',
      'number.base': '服务类型ID必须是数字'
    }),
  title: Joi.string().min(2).max(100).required()
    .messages({
      'any.required': '工单标题是必填项',
      'string.min': '工单标题至少需要2个字符',
      'string.max': '工单标题不能超过100个字符'
    }),
  description: Joi.string().max(1000).allow('', null)
    .messages({
      'string.max': '工单描述不能超过1000个字符'
    }),
  images: Joi.array().items(Joi.string()).default([])
    .messages({
      'array.base': '图片必须是数组格式'
    }),
  contact_name: Joi.string().min(2).max(50).required()
    .messages({
      'any.required': '联系人姓名是必填项',
      'string.min': '联系人姓名至少需要2个字符',
      'string.max': '联系人姓名不能超过50个字符'
    }),
  contact_phone: Joi.string().pattern(/^1[3-9]\d{9}$/).required()
    .messages({
      'any.required': '联系电话是必填项',
      'string.pattern.base': '请输入有效的手机号码'
    }),
  service_address: Joi.string().min(5).max(200).required()
    .messages({
      'any.required': '服务地址是必填项',
      'string.min': '服务地址至少需要5个字符',
      'string.max': '服务地址不能超过200个字符'
    }),
  latitude: Joi.number().min(-90).max(90).allow(null).optional()
    .messages({
      'any.required': '纬度是必填项',
      'number.base': '纬度必须是数字',
      'number.min': '纬度必须在-90到90之间',
      'number.max': '纬度必须在-90到90之间'
    }),
  longitude: Joi.number().min(-180).max(180).allow(null).optional()
    .messages({
      'any.required': '经度是必填项',
      'number.base': '经度必须是数字',
      'number.min': '经度必须在-180到180之间',
      'number.max': '经度必须在-180到180之间'
    }),
  expected_time: Joi.date().iso().allow(null)
    .messages({
      'date.base': '预期服务时间格式不正确',
      'date.format': '预期服务时间必须是ISO格式'
    }),
  budget_min: Joi.number().min(0).allow(null)
    .messages({
      'number.base': '最低预算必须是数字',
      'number.min': '最低预算不能小于0'
    }),
  budget_max: Joi.number().min(0).allow(null)
    .messages({
      'number.base': '最高预算必须是数字',
      'number.min': '最高预算不能小于0'
    })
}).custom((value, helpers) => {
  // 自定义验证：如果同时提供了最低和最高预算，确保最低不大于最高
  if (value.budget_min && value.budget_max && value.budget_min > value.budget_max) {
    return helpers.error('custom.budgetRange', {
      message: '最低预算不能大于最高预算'
    });
  }
  return value;
});

// 获取工单列表的验证Schema
const getOrdersList = Joi.object({
  page: Joi.number().integer().min(1).default(1)
    .messages({
      'number.base': '页码必须是数字',
      'number.min': '页码必须大于等于1'
    }),
  limit: Joi.number().integer().min(1).max(100).default(20)
    .messages({
      'number.base': '每页数量必须是数字',
      'number.min': '每页数量必须大于等于1',
      'number.max': '每页数量不能超过100'
    }),
  status: Joi.string().valid('pending_payment', 'pending', 'accepted', 'in_progress', 'pending_review', 'completed', 'pending_repair_payment', 'paid', 'cancelled', 'cancel_pending', 'closed').allow(null, '')
    .messages({
      'string.base': '状态必须是字符串',
      'any.only': '状态值无效'
    }),
  service_type_id: Joi.number().integer().positive().allow(null)
    .messages({
      'number.base': '服务类型ID必须是数字',
      'number.positive': '服务类型ID必须是正数'
    }),
  search: Joi.string().max(100).allow('', null)
    .messages({
      'string.max': '搜索关键词不能超过100个字符'
    }),
  latitude: Joi.number().min(-90).max(90).allow(null)
    .messages({
      'number.base': '纬度必须是数字',
      'number.min': '纬度必须在-90到90之间',
      'number.max': '纬度必须在-90到90之间'
    }),
  longitude: Joi.number().min(-180).max(180).allow(null)
    .messages({
      'number.base': '经度必须是数字',
      'number.min': '经度必须在-180到180之间',
      'number.max': '经度必须在-180到180之间'
    }),
  distance: Joi.number().positive().default(1000).allow(null)
    .messages({
      'number.base': '距离必须是数字',
      'number.positive': '距离必须是正数'
    }),
  my_orders: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'my_orders必须是布尔值'
    })
});

// 获取工单详情的验证Schema
const getOrderDetail = Joi.object({
  id: Joi.number().integer().positive().required()
    .messages({
      'any.required': '工单ID是必填项',
      'number.base': '工单ID必须是数字',
      'number.positive': '工单ID必须是正数'
    })
});

// 电工抢单不需要参数验证

// 完成工单的验证Schema
const completeOrder = Joi.object({
  repair_content: Joi.string().min(5).max(1000).optional()
    .messages({
      'string.min': '维修内容至少需要5个字符',
      'string.max': '维修内容不能超过1000个字符'
    }),
  completion_note: Joi.string().min(5).max(1000).optional()
    .messages({
      'string.min': '完成说明至少需要5个字符',
      'string.max': '完成说明不能超过1000个字符'
    }),
  repair_images: Joi.array().items(Joi.string()).max(9).default([])
    .messages({
      'array.max': '最多上传9张图片'
    })
});

// 取消工单的验证Schema
const cancelOrder = Joi.object({
  cancel_reason: Joi.string().min(2).max(200).required()
    .messages({
      'any.required': '取消原因是必填项',
      'string.min': '取消原因至少需要2个字符',
      'string.max': '取消原因不能超过200个字符'
    })
});

// 确认工单的验证Schema
const confirmOrder = Joi.object({
  confirmed: Joi.boolean().valid(true).optional()
    .messages({
      'boolean.base': '确认状态必须是布尔值',
      'any.only': '确认状态必须为true'
    })
}).optional();

// 电工修改订单内容和金额的验证Schema
const updateOrderByElectrician = Joi.object({
  title: Joi.string().min(2).max(100).optional()
    .messages({
      'string.min': '工单标题至少需要2个字符',
      'string.max': '工单标题不能超过100个字符'
    }),
  description: Joi.string().max(1000).optional()
    .messages({
      'string.max': '工单描述不能超过1000个字符'
    }),
  repair_content: Joi.string().min(2).max(1000).optional()
    .messages({
      'string.min': '维修内容至少需要2个字符',
      'string.max': '维修内容不能超过1000个字符'
    }),
  repair_images: Joi.array().items(Joi.string()).max(9).default([])
    .messages({
      'array.max': '维修图片最多上传9张'
    }),
  amount: Joi.number().min(0).required()
    .messages({
      'any.required': '订单金额是必填项',
      'number.base': '订单金额必须是数字',
      'number.min': '订单金额不能小于0'
    }),
  remark: Joi.string().max(500).optional()
    .messages({
      'string.max': '备注不能超过500个字符'
    })
});

// 订单取消发起的验证Schema
const initiateCancelOrder = Joi.object({
  reason: Joi.string().max(500).required()
    .messages({
      'any.required': '取消原因是必填项',
      'string.max': '取消原因不能超过500个字符'
    })
});

// 订单取消确认的验证Schema
const confirmCancelOrder = Joi.object({
  cancel_reason: Joi.string().max(500).required()
    .messages({
      'any.required': '取消原因是必填项',
      'string.max': '取消原因最多500字符'
    })
});

// 开始维修的验证Schema（电工端），可选备注
const startOrder = Joi.object({
  remark: Joi.string().max(500).optional()
    .messages({
      'string.max': '备注不能超过500个字符'
    })
}).optional();

// 用户评价订单的验证Schema
const reviewOrder = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required()
    .messages({
      'any.required': '评分是必填项',
      'number.base': '评分必须是数字',
      'number.min': '评分不能小于1',
      'number.max': '评分不能大于5'
    }),
  comment: Joi.string().max(1000).allow('', null)
    .messages({
      'string.max': '评价内容不能超过1000个字符'
    })
}).optional();

module.exports = {
  createOrder,
  getOrdersList,
  getOrderDetail,
  completeOrder,
  cancelOrder,
  confirmOrder,
  updateOrderByElectrician,
  initiateCancelOrder,
  confirmCancelOrder,
  startOrder,
  reviewOrder
};
