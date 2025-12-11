/**
 * 管理员模型
 * 用于存储系统管理员信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '管理员ID'
  },
  
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码(加密)'
  },
  
  real_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '真实姓名'
  },
  
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱',
    validate: {
      isEmail: true
    }
  },
  
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态'
  },
  
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后登录时间'
  }
  
}, {
  tableName: 'admins',
  timestamps: true,
  indexes: [
    { fields: ['username'], unique: true },
    { fields: ['status'] },
    { fields: ['email'] }
  ]
});

module.exports = Admin;