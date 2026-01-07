const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Withdrawal = sequelize.define('Withdrawal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  electrician_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '电工ID'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '提现金额'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'success', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '提现状态'
  },
  
  // 微信支付相关
  out_batch_no: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '商户批次单号'
  },
  transfer_bill_no: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '微信批次单号'
  },
  openid: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '用户openid'
  },
  real_name: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '收款人姓名'
  },
  
  // 余额快照
  total_income_snapshot: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '提现时的总收入快照'
  },
  withdrawn_snapshot: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '提现时的已提现金额快照'
  },
  available_balance_snapshot: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '提现时的可用余额快照'
  },
  
  // 失败信息
  fail_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '失败原因'
  },
  
  // 时间戳
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  }
}, {
  tableName: 'Withdrawals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['electrician_id'] },
    { fields: ['status'] },
    { fields: ['out_batch_no'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Withdrawal;