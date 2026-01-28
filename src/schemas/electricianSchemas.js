const Joi = require('joi');
// 🔥 在文件顶部添加自定义验证函数
const imagePathValidator = (value, helpers) => {
  // 允许空值
  if (!value || value === '') {
    return value;
  }
  
  // 允许完整URL
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  
  // 允许相对路径（/uploads/ 开头）
  if (value.startsWith('/uploads/')) {
    return value;
  }
  
  // 不符合任何格式
  return helpers.message('图片路径必须是完整URL或/uploads/开头的相对路径');
};

module.exports = {
  electricianCertificationSchema: Joi.object({
    work_types: Joi.string()
      .pattern(/^(maintenance|installation)(,maintenance|,installation)?$/)
      .default('maintenance')
      .required()
      .messages({
        'string.pattern.base': '工作类型格式不正确，必须是 maintenance 或 installation 或两者组合',
        'any.required': '工作类型不能为空'
      }),
      
    real_name: Joi.string().min(2).max(50).required()
      .messages({ 'any.required': '真实姓名不能为空' }),
      
    id_card: Joi.string()
      .pattern(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/)
      .required()
      .messages({ 'string.pattern.base': '身份证号格式不正确' }),

    // 🔥 修改：使用自定义验证器
    id_card_front: Joi.string().custom(imagePathValidator).allow(null, ''),
    id_card_back: Joi.string().custom(imagePathValidator).allow(null, ''),
      
    electrician_cert_no: Joi.string().required()
      .messages({ 'any.required': '电工证编号不能为空' }),

    // 🔥 修改：使用自定义验证器
    certificate_img: Joi.string().custom(imagePathValidator).allow(null, ''),
      
    cert_start_date: Joi.date().required()
      .messages({ 'any.required': '证书开始日期不能为空' }),
      
    cert_end_date: Joi.date().greater(Joi.ref('cert_start_date')).required()
      .messages({ 
        'any.required': '证书结束日期不能为空',
        'date.greater': '结束日期必须大于开始日期' 
      })
  })
};

/* 2026.1.28 注释
// 直接导出 Joi 对象，与其他 schema 文件保持一致
module.exports = {
  electricianCertificationSchema: Joi.object({
    work_types: Joi.string()
      .pattern(/^(maintenance|installation)(,maintenance|,installation)?$/)
      .default('maintenance')
      .required()
      .messages({
        'string.pattern.base': '工作类型格式不正确，必须是 maintenance 或 installation 或两者组合',
        'any.required': '工作类型不能为空'
      }),
      
    real_name: Joi.string().min(2).max(50).required()
      .messages({ 'any.required': '真实姓名不能为空' }),
      
    id_card: Joi.string()
      .pattern(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/)
      .required()
      .messages({ 'string.pattern.base': '身份证号格式不正确' }),

    id_card_front: Joi.string().uri().allow(null, ''),
    id_card_back: Joi.string().uri().allow(null, ''),
      
    electrician_cert_no: Joi.string().required()
      .messages({ 'any.required': '电工证编号不能为空' }),

    certificate_img: Joi.string().uri().allow(null, ''),
      
    cert_start_date: Joi.date().required()
      .messages({ 'any.required': '证书开始日期不能为空' }),
      
    cert_end_date: Joi.date().greater(Joi.ref('cert_start_date')).required()
      .messages({ 
        'any.required': '证书结束日期不能为空',
        'date.greater': '结束日期必须大于开始日期' 
      })
  })
};
*/