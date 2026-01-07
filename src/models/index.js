/**
 * 模型关联定义文件
 * 用于定义所有模型之间的关联关系
 */
const sequelize = require('../config/sequelize');

// 导入所有模型
const User = require('./User');
const Order = require('./Order');
const ElectricianCertification = require('./ElectricianCertification');
const Address = require('./Address');
const Message = require('./Message');
const Payment = require('./Payment');
const Review = require('./Review');
const ServiceType = require('./ServiceType');
const SystemMessage = require('./SystemMessage');
const OrderStatusLog = require('./OrderStatusLog');
const Admin = require('./Admin');
const Withdrawal = require('./Withdrawal');

// 定义关联关系

// 1. User - ElectricianCertification: 一对一
User.hasOne(ElectricianCertification, {
  foreignKey: 'user_id',
  as: 'certification'
});
ElectricianCertification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 2. User - Order: 一对多（用户 -> 订单）
User.hasMany(Order, {
  foreignKey: 'user_id',
  as: 'orders'
});
Order.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 3. User - Order: 一对多（电工 -> 订单）
User.hasMany(Order, {
  foreignKey: 'electrician_id',
  as: 'electrician_orders'
});
Order.belongsTo(User, {
  foreignKey: 'electrician_id',
  as: 'electrician'
});

// 4. Order - ServiceType: 多对一
ServiceType.hasMany(Order, {
  foreignKey: 'service_type_id',
  as: 'orders'
});
Order.belongsTo(ServiceType, {
  foreignKey: 'service_type_id',
  as: 'serviceType'
});

// 5. Order - Payment: 一对一
Order.hasOne(Payment, {
  foreignKey: 'order_id',
  as: 'payment'
});
Payment.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 6. Order - Review: 一对一
Order.hasOne(Review, {
  foreignKey: 'order_id',
  as: 'review'
});
Review.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 7. Order - OrderStatusLog: 一对多
Order.hasMany(OrderStatusLog, {
  foreignKey: 'order_id',
  as: 'status_logs'
});
OrderStatusLog.belongsTo(Order, {
  foreignKey: 'order_id',
  as: 'order'
});

// 8. User - Address: 一对多
User.hasMany(Address, {
  foreignKey: 'user_id',
  as: 'addresses'
});
Address.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 9. User - Message: 一对多
User.hasMany(Message, {
  foreignKey: 'user_id',
  as: 'messages'
});
Message.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 10. Order - Message: 订单相关消息
Order.hasMany(Message, {
  foreignKey: 'related_id',
  as: 'notifications'
});
Message.belongsTo(Order, {
  foreignKey: 'related_id',
  as: 'order'
});

// 11. SystemMessage - User (通过 UserMessageRead)
const UserMessageRead = require('./UserMessageRead');

SystemMessage.belongsToMany(User, {
  through: UserMessageRead,
  foreignKey: 'message_id',
  otherKey: 'user_id',
  as: 'readUsers'
});

User.belongsToMany(SystemMessage, {
  through: UserMessageRead,
  foreignKey: 'user_id',
  otherKey: 'message_id',
  as: 'readMessages'
});

// 12. User - Withdrawal: 一对多（电工 -> 提现记录）
User.hasMany(Withdrawal, {
  foreignKey: 'electrician_id',
  as: 'withdrawals'
});
Withdrawal.belongsTo(User, {
  foreignKey: 'electrician_id',
  as: 'electrician'
});

// 导出所有模型和sequelize实例
module.exports = {
  sequelize,
  User,
  Order,
  ElectricianCertification,
  Address,
  Message,
  Payment,
  Review,
  ServiceType,
  SystemMessage,
  OrderStatusLog,
  Admin,
  UserMessageRead,
  Withdrawal,  // ✅ 添加这一行
  Sequelize: require('sequelize')
};