/**
 * 评价模型
 * 用于存储用户对电工的评价信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '评价ID'
  },
  
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '工单ID'
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  
  electrician_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '电工ID'
  },
  
  rating: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '评分(1-5)',
    validate: {
      min: 1,
      max: 5
    }
  },
  
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '评价内容'
  },
  
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '评价图片URLs'
  }
  
}, {
  tableName: 'reviews',
  timestamps: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['user_id'] },
    { fields: ['electrician_id'] },
    { fields: ['rating'] }
  ]
});

module.exports = Review;