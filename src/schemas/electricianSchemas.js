const Joi = require('joi');

// 直接导出 Joi 对象，与其他 schema 文件保持一致
module.exports = {
  electricianCertificationSchema: Joi.object({
    real_name: Joi.string().min(2).max(50).required()
      .messages({ 'any.required': '真实姓名不能为空' }),
      
    id_card: Joi.string()
      .pattern(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/)
      .required()
      .messages({ 'string.pattern.base': '身份证号格式不正确' }),
      
    electrician_cert_no: Joi.string().required()
      .messages({ 'any.required': '电工证编号不能为空' }),
      
    cert_start_date: Joi.date().required()
      .messages({ 'any.required': '证书开始日期不能为空' }),
      
    cert_end_date: Joi.date().greater(Joi.ref('cert_start_date')).required()
      .messages({ 
        'any.required': '证书结束日期不能为空',
        'date.greater': '结束日期必须大于开始日期' 
      })
  })
};
