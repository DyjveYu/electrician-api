const Joi = require('joi');

// 手机号验证正则
const PHONE_REGEX = /^1[3-9]\d{9}$/;

// 发送验证码验证模式
const sendCode = Joi.object({
  phone: Joi.string()
    .pattern(PHONE_REGEX)
    .required()
    .messages({
      'string.pattern.base': '手机号格式不正确',
      'any.required': '手机号不能为空'
    }),
  type: Joi.string()
    .valid('login', 'register')
    .required()
    .messages({
      'any.only': 'type 必须是 login 或 register',
      'any.required': 'type 不能为空'
    })
});

// 用户登录验证模式
const login = {
  body: Joi.object({
    phone: Joi.string()
      .pattern(PHONE_REGEX)
      .required()
      .messages({
        'string.pattern.base': '手机号格式不正确',
        'any.required': '手机号不能为空'
      }),
    code: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': '验证码必须为6位数字',
        'string.pattern.base': '验证码必须为数字',
        'any.required': '验证码不能为空'
      }),
    initialRole: Joi.string()
      .valid('user', 'electrician')
      .optional()
      .default('user')
      .messages({
        'any.only': '角色必须是 user 或 electrician'
      })
  })
};

// 用户资料更新验证模式
const updateProfile = {
  body: Joi.object({
    nickname: Joi.string().min(1).max(50).optional().messages({
      'string.min': '昵称不能为空',
      'string.max': '昵称不能超过50个字符'
    }),
    avatar: Joi.string().optional().messages({
      'string.empty': '头像不能为空字符串'
    }),
    gender: Joi.string().valid('male', 'female', 'unknown').optional().messages({
      'any.only': '性别只能是male、female或unknown'
    }),
    birthday: Joi.date().optional().messages({
      'date.base': '生日必须是有效的日期格式'
    }),
    bio: Joi.string().max(200).optional().messages({
      'string.max': '个人简介不能超过200个字符'
    })
  }).min(1).messages({
    'object.min': '至少需要提供一个要更新的字段'
  })
};

// 切换角色验证模式
const switchRole = {
  body: Joi.object({
    role: Joi.string()
      .valid('user', 'electrician')
      .required()
      .messages({
        'any.only': '角色必须是 user 或 electrician',
        'any.required': '角色不能为空'
      })
  })
};

// 获取用户资料验证模式
const getProfile = {
  params: Joi.object({
    id: Joi.string().optional()
  })
};

module.exports = {
  sendCode,
  login,
  updateProfile,
  switchRole,
  getProfile
};