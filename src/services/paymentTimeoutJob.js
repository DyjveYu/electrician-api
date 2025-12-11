/**
 * 预付款超时自动关闭任务
 * 每分钟扫描超时未支付的预付款，关闭支付并关闭工单
 */
const sequelize = require('../config/sequelize');
const { Op } = require('sequelize');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderStatusLog = require('../models/OrderStatusLog');
const Message = require('../models/Message');

function initPaymentTimeoutJob() {
  const INTERVAL_MS = 60 * 1000; // 每分钟
  const EXPIRE_MINUTES = 30; // 30分钟未支付

  setInterval(async () => {
    const cutoff = new Date(Date.now() - EXPIRE_MINUTES * 60 * 1000);
    try {
      // 查找超时未支付的预付款
      const overduePayments = await Payment.findAll({
        where: {
          status: 'pending',
          type: 'prepay',
          created_at: { [Op.lte]: cutoff }
        },
        limit: 100
      });

      for (const pay of overduePayments) {
        await sequelize.transaction(async (t) => {
          // 标记支付为过期
          await pay.update({ status: 'expired' }, { transaction: t });

          // 关闭工单（仅当仍处于待支付预付款）
          const order = await Order.findByPk(pay.order_id, { transaction: t });
          if (order && order.status === 'pending_payment') {
            await order.update({ status: 'closed', cancelled_at: new Date(), cancel_reason: '预付款超时未支付，系统自动关闭' }, { transaction: t });

            // 状态日志
            await OrderStatusLog.create({
              order_id: order.id,
              to_status: 'closed',
              operator_id: order.user_id,
              operator_type: 'system',
              remark: '预付款超时未支付，系统自动关闭'
            }, { transaction: t });

            // 发送消息通知
            await Message.create({
              user_id: order.user_id,
              title: '工单已关闭',
              content: `您的工单 ${order.order_no} 因30分钟内未支付预付款，已自动关闭。`,
              type: 'order',
              related_id: order.id,
              to_status: 'unread'
            }, { transaction: t });
          }
        });
      }
    } catch (err) {
      console.error('预付款超时关闭任务失败:', err);
    }
  }, INTERVAL_MS);
}

module.exports = { initPaymentTimeoutJob };