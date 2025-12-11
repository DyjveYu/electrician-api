/**
 * 消息模型
 * 用于存储系统消息和工单相关消息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '消息ID'
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '接收用户ID'
  },
  
  type: {
    type: DataTypes.ENUM('order', 'system'),
    allowNull: false,
    comment: '消息类型'
  },
  
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '消息标题'
  },
  
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '消息内容'
  },
  
  related_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '关联ID(如工单ID)'
  },
  
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已读'
  },
  
  read_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '阅读时间'
  }
  
}, {
  tableName: 'messages',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['type'] },
    { fields: ['is_read'] },
    { fields: ['related_id'] }
  ]
});

module.exports = Message;