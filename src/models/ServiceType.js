/**
 * 服务类型模型
 * 用于存储维修服务类型信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ServiceType = sequelize.define('ServiceType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '服务类型ID'
  },
  
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '服务类型名称'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '服务描述'
  },
  
  icon_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '图标URL'
  },
  
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序'
  },
  
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态'
  }
  ,
  prepay_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '预付款金额（用于预约时展示与下单）'
  }
  ,
  prepay_note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '预付款备注说明'
  }
  
}, {
  tableName: 'service_types',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['sort_order'] }
  ]
});

module.exports = ServiceType;