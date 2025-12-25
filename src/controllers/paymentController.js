/**
 * 支付控制器 - 集成微信支付V3
 * 处理支付创建、查询、回调等功能
 */

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const ServiceType = require('../models/ServiceType');
const OrderStatusLog = require('../models/OrderStatusLog');
const Message = require('../models/Message');
const WechatPayV3Service = require('../utils/WechatPayV3Service');

// 维修费支付成功状态转移函数
async function transitionRepairPaymentSuccess(order, operatorId, remark = '维修费支付成功，订单进入维修中') {
  const now = new Date();

  await Order.update({
    status: 'in_progress',
    repair_paid_at: now
  }, { where: { id: order.id } });

  await OrderStatusLog.create({
    order_id: order.id,
    from_status: order.status,
    to_status: 'in_progress',
    operator_id: operatorId || order.user_id,
    operator_type: operatorId ? 'user' : 'system',
    remark
  });

  await Message.create({
    user_id: order.user_id,
    title: '维修费支付成功',
    content: `您的工单 ${order.order_no} 维修费已支付成功，电工即将上门维修。`,
    type: 'order',
    related_id: order.id,
    to_status: 'unread'
  });

  if (order.electrician_id) {
    await Message.create({
      user_id: order.electrician_id,
      title: '用户已支付维修费',
      content: `工单 ${order.order_no} 用户已支付维修费，请尽快安排维修。`,
      type: 'order',
      related_id: order.id,
      to_status: 'unread'
    });
  }
}

class PaymentController {
  /**
   * 创建支付订单 - V3版本
   */
  static async createPayment(req, res, next) {
    let payment; // 提升作用域，方便错误处理
    try {
      const userId = req.user.id;
      const {
        order_id,
        payment_method = 'wechat',
        openid,
        type = 'prepay'
      } = req.body;

      // 验证工单
      const order = await Order.findByPk(order_id);
      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 验证工单归属
      if (order.user_id !== userId) {
        return res.error('无权限支付此工单', 403);
      }

      // 分类型校验与金额确定
      let amount = 0;
      let description = '';
      if (type === 'prepay') {
        if (order.status !== 'pending_payment') {
          return res.error('当前工单不处于待支付预付款状态', 400);
        }
        // 读取服务类型预付款金额
        const serviceType = await ServiceType.findByPk(order.service_type_id);
        if (!serviceType || !serviceType.prepay_amount || Number(serviceType.prepay_amount) <= 0) {
          return res.error('预付款金额未配置或无效', 400);
        }
        amount = Number(serviceType.prepay_amount);
        description = `工单预付款-${serviceType.name || order.title}`;
      } else if (type === 'repair') {
        // 仅允许在待支付维修费状态下创建维修费支付
        if (order.status !== 'pending_repair_payment') {
          return res.error('当前工单不处于待支付维修费状态', 400);
        }
        if (!order.final_amount || Number(order.final_amount) <= 0) {
          return res.error('工单最终金额异常', 400);
        }
        amount = Number(order.final_amount);
        description = `工单支付-${order.title}`;
      } else {
        return res.error('无效的支付类型', 400);
      }

      // 检查是否已有待支付的订单
      payment = await Payment.findOne({
        where: {
          order_id: order_id,
          status: 'pending',
          type
        }
      });

      // 生成商户订单号（如果复用原有订单，则用原来的out_trade_no）
      let out_trade_no;
      if (payment) {
        out_trade_no = payment.out_trade_no;
        console.log(`复用已有支付订单: ${payment.id}, out_trade_no: ${out_trade_no}`);
      } else {
        const now = new Date();
        out_trade_no = `PAY${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      }

      // 根据支付方式处理
      if (payment_method === 'wechat') {
        const wxPayService = new WechatPayV3Service();

        // 构建微信支付V3请求数据
        const wechatOrderData = {
          description,
          out_trade_no,
          amount,
          openid,
          // V3接口的过期时间格式：ISO 8601（30分钟后过期）
          time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+08:00')
        };

        console.log('调用微信支付V3接口，参数:', wechatOrderData);

        // 调用V3接口
        const paymentResult = await wxPayService.createJsapiOrder(wechatOrderData);

        if (!paymentResult.success) {
          throw new Error(paymentResult.error || '微信支付下单失败');
        }

        // 支付记录数据
        const paymentData = {
          order_id,
          user_id: userId,
          amount: amount,
          payment_method,
          out_trade_no,
          type,
          prepay_id: paymentResult.prepay_id, // 新增：保存prepay_id
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
          status: 'pending'
        };

        if (payment) {
          // 更新现有支付记录
          await payment.update(paymentData);
        } else {
          // 创建新支付记录
          payment = await Payment.create(paymentData);
        }

        // 返回给小程序的数据
        res.success({
          payment_id: payment.id,
          payment_no: payment.out_trade_no,
          amount: payment.amount,
          // V3接口返回的支付参数包（小程序直接使用的5个参数）
          timeStamp: paymentResult.pay_params.timeStamp,
          nonceStr: paymentResult.pay_params.nonceStr,
          package: paymentResult.pay_params.package,
          signType: paymentResult.pay_params.signType,
          paySign: paymentResult.pay_params.paySign,
          appId: paymentResult.pay_params.appId, // 小程序需要appId
          pay_params: paymentResult.pay_params // 同时保留完整对象
        });

      } else if (payment_method === 'test') {
        // 测试支付逻辑保持不变
        // 支付记录数据
        const paymentData = {
          order_id,
          user_id: userId,
          amount: amount,
          payment_method,
          out_trade_no: payment ? payment.out_trade_no : out_trade_no,
          type,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 60 * 1000)
        };

        if (payment) {
          // 更新现有支付记录
          await payment.update(paymentData);
        } else {
          // 创建新支付记录
          payment = await Payment.create(paymentData);
        }

        // 测试支付返回
        res.success({
          code: 200,
          message: 'success',
          data: {
            payment_id: payment.id,
            payment_no: payment.out_trade_no,
            amount: payment.amount,
            test: true
          }
        });
      } else {
        return res.error('不支持的支付方式', 400);
      }
    } catch (error) {
      console.error('创建支付失败:', error);

      // 如果有创建payment记录但支付失败，更新状态
      if (payment && payment.id) {
        await Payment.update({
          status: 'failed',
          failed_reason: error.message.substring(0, 250) // 防止超长
        }, { where: { id: payment.id } });
      }

      // 保持错误响应格式
      res.error(error.message || '支付创建失败', 500);
    }
  }

  /**
   * 测试支付确认
   */
  static async confirmTestPayment(req, res, next) {
    try {
      const { payment_no } = req.body;
      const userId = req.user.id;

      // 查找支付记录
      const payment = await Payment.findOne({
        where: {
          out_trade_no: payment_no
        }
      });
      if (!payment) {
        return res.error('支付记录不存在', 404);
      }

      // 验证用户权限
      if (payment.user_id !== userId) {
        return res.error('无权限操作此支付', 403);
      }

      // 验证支付方式
      if (payment.payment_method !== 'test') {
        return res.error('非测试支付，无法手动确认', 400);
      }

      // 验证支付状态
      if (payment.status !== 'pending') {
        return res.error('支付状态异常', 400);
      }

      // 模拟支付成功
      const transactionData = {
        transaction_id: `test_${Date.now()}`,
        time_end: new Date().toISOString(),
        test: true
      };

      // 更新支付状态为成功
      await Payment.update({
        status: 'success',
        transaction_id: transactionData.transaction_id,
        paid_at: new Date()
      }, {
        where: { out_trade_no: payment_no }
      });

      // 根据支付类型更新订单状态
      const order = await Order.findByPk(payment.order_id);
      if (order) {
        if (payment.type === 'prepay') {
          await Order.update({
            status: 'pending',
            prepaid_at: new Date()
          }, { where: { id: payment.order_id } });

          // 状态日志与消息
          await OrderStatusLog.create({
            order_id: payment.order_id,
            to_status: 'pending',
            operator_id: userId,
            operator_type: 'user',
            remark: '预付款支付成功，进入待接单'
          });
          await Message.create({
            user_id: order.user_id,
            title: '预付款支付成功',
            content: `您的工单 ${order.order_no} 预付款已支付成功，现已进入待接单。`,
            type: 'order',
            related_id: order.id,
            to_status: 'unread'
          });
        } else {
          await transitionRepairPaymentSuccess(order, userId);
        }
      }

      res.success({
        message: '测试支付确认成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 微信支付V3回调 - 注意：V3是JSON格式，不是XML！
   */
  static async wechatNotify(req, res, next) {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${timestamp}] 🔔 收到微信支付回调请求`);
    console.log(`${'='.repeat(80)}`);

    try {
      // V3接口回调是JSON格式
      const headers = req.headers;
      const body = req.body; // JSON对象

      console.log('📋 支付请求头信息:', {
        'wechatpay-signature': headers['wechatpay-signature'] ? '已提供' : '❌ 缺失',
        'wechatpay-serial': headers['wechatpay-serial'] || '❌ 缺失',
        'wechatpay-nonce': headers['wechatpay-nonce'] || '❌ 缺失',
        'wechatpay-timestamp': headers['wechatpay-timestamp'] || '❌ 缺失',
        'content-type': headers['content-type'],
        'user-agent': headers['user-agent']
      });

      console.log('📦 请求体:', JSON.stringify(body, null, 2));

      const wxPayService = new WechatPayV3Service();

      // 处理支付通知（会自动验证签名）
      const notifyResult = await wxPayService.handlePaymentNotify(headers, body);

      if (!notifyResult.success) {
        console.error('微信支付V3回调验证失败:', notifyResult.error);
        return res.json(wxPayService.generateFailResponse(notifyResult.error));
      }

      console.log('✅ 微信支付回调验证成功:', {
        out_trade_no: notifyResult.out_trade_no,
        transaction_id: notifyResult.transaction_id,
        trade_state: notifyResult.trade_state
      });

      // 查找支付记录
      console.log('🔍 查找支付记录, out_trade_no:', notifyResult.out_trade_no);
      const payment = await Payment.findOne({
        where: { out_trade_no: notifyResult.out_trade_no }
      });

      if (!payment) {
        console.error('❌ 支付记录不存在:', notifyResult.out_trade_no);
        return res.json(wxPayService.generateFailResponse('支付记录不存在'));
      }

      console.log('📄 找到支付记录:', {
        payment_id: payment.id,
        order_id: payment.order_id,
        type: payment.type,
        current_status: payment.status
      });

      // 检查是否已处理过（防止重复通知）
      if (payment.status === 'success') {
        console.log('支付已处理，忽略重复通知:', notifyResult.out_trade_no);
        return res.json(wxPayService.generateSuccessResponse());
      }

      // 更新支付状态
      console.log('💾 更新支付状态为 success...');
      await Payment.update({
        status: 'success',
        transaction_id: notifyResult.transaction_id,
        paid_at: new Date(notifyResult.success_time || new Date())
      }, {
        where: { out_trade_no: notifyResult.out_trade_no }
      });
      console.log('✅ 支付状态更新成功');

      // 按支付类型更新订单状态
      console.log('🔍 查找订单, order_id:', payment.order_id);
      const order = await Order.findByPk(payment.order_id);
      if (order) {
        console.log('📋 找到订单:', {
          order_no: order.order_no,
          current_status: order.status,
          payment_type: payment.type
        });
        if (payment.type === 'prepay') {
          console.log('💰 处理预付款支付成功逻辑...');
          await Order.update({
            status: 'pending',
            prepaid_at: new Date()
          }, { where: { id: payment.order_id } });

          await OrderStatusLog.create({
            order_id: payment.order_id,
            to_status: 'pending',
            operator_id: order.user_id,
            operator_type: 'user',
            remark: '预付款支付成功，进入待接单'
          });

          await Message.create({
            user_id: order.user_id,
            title: '预付款支付成功',
            content: `您的工单 ${order.order_no} 预付款已支付成功，现已进入待接单。`,
            type: 'order',
            related_id: order.id,
            to_status: 'unread'
          });
          console.log('✅ 订单状态已更新为 pending (待接单)');
        } else {
          console.log('🔧 处理维修费支付成功逻辑...');
          await transitionRepairPaymentSuccess(order, order.user_id);
          console.log('✅ 订单状态已更新为 in_progress (维修中)');
        }
      } else {
        console.error('❌ 订单不存在, order_id:', payment.order_id);
      }

      console.log('🎉 支付回调处理完成:', notifyResult.out_trade_no);
      console.log(`${'='.repeat(80)}\n`);

      // 返回成功响应（V3要求JSON格式）
      res.json(wxPayService.generateSuccessResponse());

    } catch (error) {
      console.error('微信支付V3回调处理失败:', error);
      const wxPayService = new WechatPayV3Service();
      res.json(wxPayService.generateFailResponse('处理失败'));
    }
  }

  /**
   * 查询支付状态 - V3版本
   */
  static async queryPayment(req, res, next) {
    try {
      const { payment_no } = req.params;
      const userId = req.user.id;

      let payment = await Payment.findOne({
        where: { out_trade_no: payment_no }
      });

      if (!payment) return res.error('支付记录不存在', 404);
      if (payment.user_id !== userId) return res.error('无权限查看此支付', 403);

      // 如果是pending状态且是微信支付，尝试查询最新状态
      if (payment.status === 'pending' && payment.payment_method === 'wechat') {
        try {
          const wxPayService = new WechatPayV3Service();
          const queryResult = await wxPayService.queryOrder(payment_no);

          console.log('主动查询支付状态结果:', queryResult);

          if (queryResult.success && queryResult.trade_state === 'SUCCESS') {
            // 支付成功，更新状态
            await Payment.update({
              status: 'success',
              transaction_id: queryResult.transaction_id,
              paid_at: new Date()
            }, { where: { out_trade_no: payment_no } });

            // 更新订单状态
            const order = await Order.findByPk(payment.order_id);
            if (order) {
              if (payment.type === 'prepay') {
                await Order.update({
                  status: 'pending',
                  prepaid_at: new Date()
                }, { where: { id: payment.order_id } });

                await OrderStatusLog.create({
                  order_id: payment.order_id,
                  to_status: 'pending',
                  operator_id: order.user_id,
                  operator_type: 'user',
                  remark: '预付款支付成功，进入待接单'
                });

                await Message.create({
                  user_id: order.user_id,
                  title: '预付款支付成功',
                  content: `您的工单 ${order.order_no} 预付款已支付成功，现已进入待接单。`,
                  type: 'order',
                  related_id: order.id,
                  to_status: 'unread'
                });
              } else {
                await OrderStatusLog.create({
                  order_id: payment.order_id,
                  to_status: 'pending_repair_payment',
                  operator_id: order.user_id,
                  operator_type: 'user',
                  remark: '维修费支付成功'
                });

                await Message.create({
                  user_id: order.user_id,
                  title: '维修费支付成功',
                  content: `您的工单 ${order.order_no} 维修费已支付成功，请等待电工开始维修。`,
                  type: 'order',
                  related_id: order.id,
                  to_status: 'unread'
                });
              }
            }

            // 重新查询更新后的支付记录
            payment = await Payment.findOne({
              where: { out_trade_no: payment_no }
            });
          } else if (queryResult.success && queryResult.trade_state === 'CLOSED') {
            // 订单已关闭
            await Payment.update({
              status: 'expired',
              failed_reason: '支付超时关闭'
            }, { where: { out_trade_no: payment_no } });
            payment = await Payment.findOne({ where: { out_trade_no: payment_no } });
          }
        } catch (error) {
          console.error('查询微信支付状态失败:', error);
          // 不抛出错误，继续返回当前状态
        }
      }

      res.success({ payment });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取支付列表
   */
  static async getPaymentList(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        status,
        payment_method,
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        user_id: userId,
        status,
        payment_method,
        search
      };

      const result = await Payment.getList(options);
      res.success(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取支付统计
   */
  static async getPaymentStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { date_range } = req.query;

      const options = {
        user_id: userId
      };

      if (date_range) {
        try {
          const range = JSON.parse(date_range);
          options.date_range = range;
        } catch (e) {
          // 忽略无效的日期范围
        }
      }

      const stats = await Payment.getStats(options);
      res.success({ stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 申请退款
   */
  static async requestRefund(req, res, next) {
    try {
      const { payment_no } = req.params;
      const { reason = '用户申请退款' } = req.body;
      const userId = req.user.id;

      const payment = await Payment.findByPaymentNo(payment_no);
      if (!payment) {
        return res.error('支付记录不存在', 404);
      }

      // 验证用户权限
      if (payment.user_id !== userId) {
        return res.error('无权限操作此支付', 403);
      }

      // 验证支付状态
      if (payment.status !== 'success') {
        return res.error('只有已支付成功的订单才能申请退款', 400);
      }

      // 检查是否已申请退款
      if (payment.refund_status === 'processing' || payment.refund_status === 'success') {
        return res.error('已申请退款，请勿重复操作', 400);
      }

      // 更新退款状态
      await Payment.updateStatus(payment.id, payment.status, {
        refund_status: 'processing',
        refund_reason: reason,
        refund_requested_at: new Date()
      });

      // 这里可以添加自动退款逻辑或者通知管理员处理

      res.success({
        message: '退款申请已提交，请等待处理'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理退款 - V3版本
   */
  static async processRefund(req, res, next) {
    try {
      const { payment_no } = req.params;
      const { action, admin_notes = '' } = req.body; // action: 'approve' | 'reject'

      const payment = await Payment.findByPaymentNo(payment_no);
      if (!payment) {
        return res.error('支付记录不存在', 404);
      }

      if (payment.refund_status !== 'processing') {
        return res.error('退款状态异常', 400);
      }

      if (action === 'approve') {
        // 执行退款 - V3接口
        if (payment.payment_method === 'wechat') {
          const wxPayService = new WechatPayV3Service();
          const refundResult = await wxPayService.createRefund({
            out_trade_no: payment.out_trade_no,
            out_refund_no: `RF${payment.out_trade_no}`,
            amount: {
              refund: payment.amount,
              total: payment.amount
            },
            reason: admin_notes || '用户申请退款'
          });

          if (refundResult.success) {
            await Payment.updateStatus(payment.id, payment.status, {
              refund_status: 'success',
              refund_id: refundResult.refund_id,
              refund_completed_at: new Date(),
              admin_notes
            });
          } else {
            throw new Error('退款执行失败: ' + (refundResult.error || '未知错误'));
          }
        } else {
          // 测试支付直接标记为退款成功
          await Payment.updateStatus(payment.id, payment.status, {
            refund_status: 'success',
            refund_id: `test_refund_${Date.now()}`,
            refund_completed_at: new Date(),
            admin_notes
          });
        }

        res.success({ message: '退款处理成功' });
      } else if (action === 'reject') {
        await Payment.updateStatus(payment.id, payment.status, {
          refund_status: 'rejected',
          admin_notes
        });
        res.success({ message: '退款申请已拒绝' });
      } else {
        res.error('无效的操作类型', 400);
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;