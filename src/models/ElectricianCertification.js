/**
 * 电工认证模型
 * 用于存储电工资质认证相关信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ElectricianCertification = sequelize.define('ElectricianCertification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '认证ID'
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID，关联users表'
  },
  
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名',
    validate: {
      len: [2, 50]
    }
  },
  
  id_card: {
    type: DataTypes.STRING(18),
    allowNull: false,
    comment: '身份证号',
    validate: {
      is: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
    }
  },
  
  electrician_cert_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '电工证编号'
  },
  
  cert_start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '证书开始日期'
  },
  
  cert_end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '证书结束日期',
    validate: {
      isAfterStartDate(value) {
        if (new Date(value) <= new Date(this.cert_start_date)) {
          throw new Error('证书结束日期必须大于开始日期');
        }
      }
    }
  },
  
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    comment: '认证状态：待审核、已通过、已拒绝'
  },
  
  reject_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '驳回原因'
  }
  
}, {
  tableName: 'electrician_certifications',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] }
  ]
});

module.exports = ElectricianCertification;