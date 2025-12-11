/**
 * 支付模型
 * 用于存储支付记录信息
 */
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/sequelize');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '支付ID'
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
  
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '支付金额'
  },
  
  payment_method: {
    type: DataTypes.ENUM('wechat', 'test'),
    defaultValue: 'wechat',
    comment: '支付方式'
  },

  type: {
    type: DataTypes.ENUM('prepay', 'repair'),
    defaultValue: 'prepay',
    allowNull: false,
    comment: '支付类型（预付款/维修费）'
  },
  
  transaction_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '微信交易号'
  },
  prepay_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '微信预支付ID（prepay_id）'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '支付过期时间'
  },
  out_trade_no: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    comment: '商户订单号'
  },
  
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'refunded', 'expired'),
    defaultValue: 'pending',
    comment: '支付状态'
  },

  failed_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '失败原因'
  },
  
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '支付时间'
  },

  // 退款相关字段
  refund_status: {
    type: DataTypes.ENUM('processing', 'success', 'rejected'),
    allowNull: true,
    comment: '退款状态'
  },
  refund_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '退款原因'
  },
  refund_requested_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '退款申请时间'
  },
  refund_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '退款ID/单号'
  },
  refund_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '退款完成时间'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '管理员备注'
  }
  
}, {
  tableName: 'payments',
  timestamps: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['out_trade_no'], unique: true }
  ]
});

// ===== 静态方法扩展 =====
/**
 * 根据支付单号查找记录
 */
Payment.findByPaymentNo = async function(paymentNo) {
  return await Payment.findOne({ where: { out_trade_no: paymentNo } });
};

/**
 * 更新支付状态（带条件防并发）
 * @param {number} id 支付ID
 * @param {string} currentStatus 当前状态（用于where保护）
 * @param {object} updates 需要更新的字段
 * @returns {boolean} 是否更新成功
 */
Payment.updateStatus = async function(id, currentStatus, updates = {}) {
  const [affected] = await Payment.update(updates, { where: { id, status: currentStatus } });
  return affected > 0;
};

/**
 * 获取支付列表
 */
Payment.getList = async function(options = {}) {
  const {
    page = 1,
    limit = 20,
    user_id,
    status,
    payment_method,
    search
  } = options;

  const where = {};
  if (user_id) where.user_id = user_id;
  if (status) where.status = status;
  if (payment_method) where.payment_method = payment_method;
  if (search) where.out_trade_no = { [Op.like]: `%${search}%` };

  const { count, rows } = await Payment.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset: (page - 1) * limit,
    limit
  });

  return {
    total: count,
    page,
    limit,
    payments: rows
  };
};

/**
 * 获取支付统计
 */
Payment.getStats = async function(options = {}) {
  const { user_id } = options;
  const where = {};
  if (user_id) where.user_id = user_id;

  // 统计各状态数量
  const statuses = ['pending', 'success', 'failed', 'refunded', 'expired'];
  const stats = { total: 0 };
  const counts = await Promise.all(statuses.map(s => Payment.count({ where: { ...where, status: s } })));
  statuses.forEach((s, i) => { stats[s] = counts[i]; stats.total += counts[i]; });

  // 成功支付总金额
  const { fn, col } = require('sequelize');
  const successAmount = await Payment.findOne({
    where: { ...where, status: 'success' },
    attributes: [[fn('SUM', col('amount')), 'sum_amount']]
  });
  stats.success_amount = Number(successAmount?.get('sum_amount') || 0);

  return stats;
};

module.exports = Payment;