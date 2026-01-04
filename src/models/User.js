/**
 * 用户模型
 * 处理用户相关的数据库操作
 */
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const jwt = require('jsonwebtoken');
// const { AppError } = require('../utils/errorHandler');
const AppError = require('../utils/AppError');
// const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '用户ID'
  },
  
  phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    unique: true,
    comment: '手机号',
    validate: {
      is: /^1[3-9]\d{9}$/
    }
  },

  openid: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    comment: '微信OpenID'
  },
  
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '用户昵称',
    validate: {
      len: [1, 50]
    }
  },
  
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '头像URL'
  },
  
  current_role: {
    type: DataTypes.ENUM('user', 'electrician'),
    defaultValue: 'user',
    comment: '当前角色'
  },
  
  can_be_electrician: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否可以成为电工'
  },
  
  status: {
    type: DataTypes.ENUM('active', 'banned'),
    defaultValue: 'active',
    comment: '账号状态'
  },
  
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后登录时间'
  }
  
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['phone'] },
    { fields: ['status'] },
    { fields: ['current_role'] }
  ]
});

/**
 * 根据手机号查找用户
 * @param {string} phone - 用户手机号
 * @returns {Promise<User|null>} - 返回用户对象或null
 */
User.findByPhone = async function(phone) {
  return await this.findOne({ where: { phone } });
};

/**
 * 根据ID查找用户
 * @param {number} id - 用户ID
 * @returns {Promise<User|null>} - 返回用户对象或null
 */
User.findById = async function(id) {
  return await this.findByPk(id);
};

/**
 * 创建用户
 * @param {Object} userData - 用户数据
 * @returns {Promise<User>} - 返回创建的用户对象
 */
User.createUser = async function(userData) {
  return await User.build(userData).save();
};

/**
 * 更新用户信息
 * @param {number} id - 用户ID
 * @param {Object} updateData - 更新的数据
 * @returns {Promise<Object>} - 返回更新结果
 */
User.update = async function(id, updateData) {
  const user = await this.findByPk(id);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  await user.update(updateData);
  
  return {
    success: true,
    message: '用户信息更新成功'
  };
};

/**
 * 切换用户角色
 * @param {number} id - 用户ID
 * @param {string} newRole - 新角色
 * @returns {Promise<boolean>} - 返回是否成功
 */
User.switchRole = async function(id, newRole) {
  const user = await this.findByPk(id);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  if (newRole === 'electrician' && !user.can_be_electrician) {
    throw new AppError('用户未通过电工认证', 403);
  }
  
  await user.update({ current_role: newRole });
  
  return true;
};

/**
 * 更新用户最后登录时间
 * @param {number} id - 用户ID
 * @returns {Promise<boolean>} - 返回是否成功
 */
User.updateLastLogin = async function(id) {
  const user = await this.findByPk(id);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  await user.update({ last_login_at: new Date() });
  
  return true;
};

/**
 * 获取用户统计信息
 * @param {number} userId - 用户ID
 * @param {string} role - 用户角色
 * @returns {Promise<Object>} - 返回统计信息
 */
User.getUserStats = async function(userId, role) {
  const { Order } = sequelize.models;
  
  // 基础统计信息
  let stats = {};
  
  // 根据角色获取不同的统计信息
  if (role === 'user') {
    // 用户角色统计 - 使用聚合函数
    const orderStats = await Order.findOne({
      where: { user_id: userId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_orders'],
        [sequelize.literal(`SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END)`), 'pending_orders'],
        [sequelize.literal(`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`), 'completed_orders'],
        [sequelize.fn('SUM', sequelize.col('final_amount')), 'total_spent']
      ],
      raw: true
    });
    
    stats = {
      total_orders: parseInt(orderStats.total_orders || 0),
      pending_orders: parseInt(orderStats.pending_orders || 0),
      completed_orders: parseInt(orderStats.completed_orders || 0),
      total_spent: parseFloat(orderStats.total_spent || 0)
    };
  } else if (role === 'electrician') {
    // 电工角色统计
    stats.total_orders = await Order.count({ where: { electrician_id: userId } });
    stats.pending_orders = await Order.count({ 
      where: { 
        electrician_id: userId,
        status: { [Op.notIn]: ['completed', 'cancelled'] }
      }
    });
    stats.completed_orders = await Order.count({ 
      where: { 
        electrician_id: userId,
        status: 'completed'
      }
    });
    
    // 电工特有统计
    stats.rating = await User.getElectricianRating(userId);
  }
  
  return stats;
};

/**
 * 获取电工评分
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} - 返回评分
 */
User.getElectricianRating = async function(userId) {
  const { Review } = sequelize.models;
  
  const reviews = await Review.findAll({
    where: { electrician_id: userId },
    attributes: ['rating']
  });
  
  if (reviews.length === 0) return 0;
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  return parseFloat((totalRating / reviews.length).toFixed(1));
};

/**
 * 获取电工认证信息
 * @param {number} userId - 用户ID
 * @returns {Promise<Object|null>} - 返回认证信息
 */
User.getElectricianCertification = async function(userId) {
  // 使用include关联查询
  const user = await User.findByPk(userId, {
    include: [{
      model: sequelize.models.ElectricianCertification,
      as: 'certification',
      attributes: ['id', 'real_name', 'id_card', 'electrician_cert_no', 'cert_start_date', 'cert_end_date', 'status', 'created_at', 'updated_at']
    }]
  });
  
  return user ? user.certification : null;
};

/**
 * 检查用户是否可以切换到电工角色
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} - 返回是否可以切换
 */
User.canSwitchToElectrician = async function(userId) {
  const user = await this.findByPk(userId);
  
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  
  if (user.can_be_electrician) {
    return true;
  }
  
  // 检查认证状态
  const { ElectricianCertification } = sequelize.models;
  const certification = await ElectricianCertification.findOne({
    where: { 
      user_id: userId,
      status: 'approved'
    }
  });
  
  if (certification) {
    // 更新用户可以成为电工的状态
    await user.update({ can_be_electrician: true });
    return true;
  }
  
  return false;
};

/**
 * 生成JWT令牌
 * @param {Object} user - 用户对象
 * @returns {string} - 返回JWT令牌
 */
User.generateToken = function(user) {
  const payload = {
    id: user.id,
    phone: user.phone,
    role: user.current_role
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * 验证JWT令牌
 * @param {string} token - JWT令牌
 * @returns {Object} - 返回解码后的数据
 */
User.verifyToken = function(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw new AppError('无效的令牌', 401);
  }
};

module.exports = User;