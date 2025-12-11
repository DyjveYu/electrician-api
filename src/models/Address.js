/**
 * 用户地址模型
 * 用于存储用户服务地址信息
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '地址ID'
  },
  
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  
  contact_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '联系人姓名'
  },
  
  contact_phone: {
    type: DataTypes.STRING(11),
    allowNull: false,
    comment: '联系电话',
    validate: {
      is: /^1[3-9]\d{9}$/
    }
  },
  
  province: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '省份'
  },
  
  city: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '城市'
  },
  
  district: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '区县'
  },
  
  detail_address: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '详细地址'
  },
  
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    comment: '经度'
  },
  
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    comment: '纬度'
  },
  
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否默认地址'
  }
  
}, {
  tableName: 'user_addresses',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'is_default'] }
  ]
});

/**
 * 根据ID获取地址
 * @param {number|Object} id - 地址ID或地址对象
 * @returns {Promise<Address|null>} - 返回地址对象或null
 */
Address.getById = async function(id) {
  // 如果传入的是地址对象，直接返回
  if (typeof id === 'object' && id !== null) {
    return id;
  }
  // 否则通过ID查询
  return await this.findByPk(id);
};

/**
 * 设置默认地址
 * @param {number} id - 要设置为默认的地址ID
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} - 返回操作是否成功
 */
Address.setDefault = async function(id, userId) {
  try {
    // 开启事务
    const transaction = await sequelize.transaction();
    
    try {
      // 1. 先将该用户的所有地址设为非默认
      await this.update(
        { is_default: false },
        { 
          where: { user_id: userId },
          transaction
        }
      );
      
      // 2. 将指定地址设为默认
      const [affectedRows] = await this.update(
        { is_default: true },
        { 
          where: { id, user_id: userId },
          transaction
        }
      );
      
      // 提交事务
      await transaction.commit();
      
      return affectedRows > 0;
    } catch (error) {
      // 回滚事务
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('设置默认地址失败:', error);
    return false;
  }
};

/**
 * 删除地址
 * @param {number} id - 地址ID
 * @returns {Promise<boolean>} - 返回操作是否成功
 */
Address.delete = async function(id) {
  try {
    const result = await this.destroy({
      where: { id }
    });
    return result > 0;
  } catch (error) {
    console.error('删除地址失败:', error);
    return false;
  }
};

/**
 * 根据用户ID获取地址列表
 * @param {number} userId - 用户ID
 * @param {number} page - 页码，默认为1
 * @param {number} limit - 每页数量，默认为10
 * @returns {Promise<Address[]>} - 返回地址列表
 */
Address.getByUserId = async function(userId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  return await this.findAll({
    where: { user_id: userId },
    order: [
      ['is_default', 'DESC'],
      ['created_at', 'DESC']
    ],
    limit,
    offset
  });
};

/**
 * 获取用户地址总数
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} - 返回地址总数
 */
Address.getCountByUserId = async function(userId) {
  return await this.count({
    where: { user_id: userId }
  });
};

/**
 * 清除用户的所有默认地址
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} - 返回操作是否成功
 */
Address.clearDefaultByUserId = async function(userId) {
  try {
    await this.update(
      { is_default: false },
      { where: { user_id: userId, is_default: true } }
    );
    return true;
  } catch (error) {
    console.error('清除默认地址失败:', error);
    return false;
  }
};

/**
 * 更新地址信息
 * @param {number} id - 地址ID
 * @param {Object} updateData - 更新数据
 * @returns {Promise<boolean>} - 返回操作是否成功
 */
Address.updateById = async function(id, updateData) {
  try {
    const [affectedRows] = await this.update(
      updateData,
      { where: { id } }
    );
    return affectedRows > 0;
  } catch (error) {
    console.error('更新地址失败:', error);
    return false;
  }
};

module.exports = Address;