/**
 * 用户消息已读记录模型
 * 用于存储用户对系统消息的已读状态
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const UserMessageRead = sequelize.define('UserMessageRead', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '记录ID'
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  
  message_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '消息ID'
  },
  
  read_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '阅读时间'
  }
  
}, {
  tableName: 'user_message_reads',
  timestamps: true,
  indexes: [
    { 
      fields: ['user_id', 'message_id'],
      unique: true
    },
    { fields: ['user_id'] },
    { fields: ['message_id'] }
  ]
});

module.exports = UserMessageRead;