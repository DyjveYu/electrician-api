const Joi = require('joi');

const addressSchemas = {
  // 获取地址列表
  getAddresses: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  // 获取地址详情
  getAddressDetail: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  },

  // 创建地址
  createAddress: {
    body: Joi.object({
      // 支持驼峰命名和下划线命名
      contactName: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '联系人姓名不能为空',
          'string.max': '联系人姓名不能超过50个字符'
        }),
      contact_name: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '联系人姓名不能为空',
          'string.max': '联系人姓名不能超过50个字符'
        }),
      contactPhone: Joi.string().pattern(/^1[3-9]\d{9}$/)
        .messages({
          'string.pattern.base': '请输入正确的手机号码'
        }),
      contact_phone: Joi.string().pattern(/^1[3-9]\d{9}$/)
        .messages({
          'string.pattern.base': '请输入正确的手机号码'
        }),
      province: Joi.string().trim().min(1).max(50).required()
        .messages({
          'string.empty': '省份不能为空',
          'string.max': '省份名称不能超过50个字符',
          'any.required': '省份是必填项'
        }),
      city: Joi.string().trim().min(1).max(50).required()
        .messages({
          'string.empty': '城市不能为空',
          'string.max': '城市名称不能超过50个字符',
          'any.required': '城市是必填项'
        }),
      district: Joi.string().trim().min(1).max(50).required()
        .messages({
          'string.empty': '区县不能为空',
          'string.max': '区县名称不能超过50个字符',
          'any.required': '区县是必填项'
        }),
      detailAddress: Joi.string().trim().min(1).max(255)
        .messages({
          'string.empty': '详细地址不能为空',
          'string.max': '详细地址不能超过255个字符'
        }),
      detail: Joi.string().trim().min(1).max(255)
        .messages({
          'string.empty': '详细地址不能为空',
          'string.max': '详细地址不能超过255个字符'
        }),
      locationName: Joi.string().trim().min(1).max(100).allow('', null)
        .messages({
          'string.max': '位置名称不能超过100个字符'
        }),
      location_name: Joi.string().trim().min(1).max(100).allow('', null)
        .messages({
          'string.max': '位置名称不能超过100个字符'
        }),
      longitude: Joi.number().min(-180).max(180).allow(null).default(null)
        .messages({
          'number.min': '经度值无效',
          'number.max': '经度值无效'
        }),
      latitude: Joi.number().min(-90).max(90).allow(null).default(null)
        .messages({
          'number.min': '纬度值无效',
          'number.max': '纬度值无效'
        }),
      isDefault: Joi.boolean().default(false),
      is_default: Joi.alternatives().try(
        Joi.boolean(),
        Joi.string().valid('true', 'false')
      ).default(false)
    })
      .or('contactName', 'contact_name')
      .or('contactPhone', 'contact_phone')
      .or('detailAddress', 'detail')
  },

  // 更新地址
  updateAddress: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
      contactName: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '联系人姓名不能为空',
          'string.max': '联系人姓名不能超过50个字符'
        }),
      contactPhone: Joi.string().pattern(/^1[3-9]\d{9}$/)
        .messages({
          'string.pattern.base': '请输入正确的手机号码'
        }),
      province: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '省份不能为空',
          'string.max': '省份名称不能超过50个字符'
        }),
      city: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '城市不能为空',
          'string.max': '城市名称不能超过50个字符'
        }),
      district: Joi.string().trim().min(1).max(50)
        .messages({
          'string.empty': '区县不能为空',
          'string.max': '区县名称不能超过50个字符'
        }),
      detailAddress: Joi.string().trim().min(1).max(255)
        .messages({
          'string.empty': '详细地址不能为空',
          'string.max': '详细地址不能超过255个字符'
        }),
      locationName: Joi.string().trim().min(1).max(100).allow('', null)
        .messages({
          'string.max': '位置名称不能超过100个字符'
        }),
      location_name: Joi.string().trim().min(1).max(100).allow('', null)
        .messages({
          'string.max': '位置名称不能超过100个字符'
        }),
      longitude: Joi.number().min(-180).max(180).allow(null)
        .messages({
          'number.min': '经度值无效',
          'number.max': '经度值无效'
        }),
      latitude: Joi.number().min(-90).max(90).allow(null)
        .messages({
          'number.min': '纬度值无效',
          'number.max': '纬度值无效'
        }),
      isDefault: Joi.boolean()
    }).min(1) // 至少需要一个字段
  },

  // 删除地址
  deleteAddress: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  },

  // 设置默认地址
  setDefaultAddress: {
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  },

  // 获取地区数据
  getRegions: {
    query: Joi.object({
      level: Joi.number().integer().min(1).max(3).default(1)
        .messages({
          'number.min': '级别参数无效',
          'number.max': '级别参数无效'
        }),
      parentCode: Joi.string().trim().allow('').default('')
        .messages({
          'string.base': '父级编码格式无效'
        })
    })
  }
};

module.exports = addressSchemas;