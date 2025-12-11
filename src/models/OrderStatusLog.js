/**
 * 工单状态日志模型
 * 用于记录工单状态变更历史
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const OrderStatusLog = sequelize.define('OrderStatusLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '日志ID'
  },
  
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '工单ID'
  },
  
  from_status: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '原状态'
  },
  
  to_status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: '新状态'
  },
  
  operator_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '操作人ID'
  },
  
  operator_type: {
    type: DataTypes.ENUM('user', 'electrician', 'admin', 'system'),
    allowNull: false,
    comment: '操作人类型'
  },
  
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
  
}, {
  tableName: 'order_status_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['operator_id'] },
    { fields: ['operator_type'] },
    { fields: ['to_status'] }
  ]
});

module.exports = OrderStatusLog;