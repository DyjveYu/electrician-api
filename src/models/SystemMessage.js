/**
 * 系统通知模型
 * 用于存储系统通知信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const SystemMessage = sequelize.define('SystemMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '通知ID'
  },
  
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '通知标题'
  },
  
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '通知内容'
  },
  
  target_users: {
    type: DataTypes.ENUM('all', 'users', 'electricians'),
    defaultValue: 'all',
    comment: '目标用户'
  },
  
  type: {
    type: DataTypes.ENUM('system', 'activity', 'maintenance', 'urgent'),
    defaultValue: 'system',
    comment: '通知类型'
  },
  
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
    comment: '优先级'
  },
  
  status: {
    type: DataTypes.ENUM('draft', 'published', 'scheduled'),
    defaultValue: 'published',
    comment: '状态'
  },
  
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '定时发布时间'
  },
  
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '发布时间'
  },
  
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '创建人ID'
  }
  
}, {
  tableName: 'system_messages',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['priority'] },
    { fields: ['target_users'] },
    { fields: ['created_by'] }
  ]
});

module.exports = SystemMessage;