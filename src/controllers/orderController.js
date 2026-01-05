/**
 * 工单管理控制器
 * 处理工单的创建、查询、状态更新等操作
 */

const { Order, User, ServiceType, OrderStatusLog, Message, Payment, Review, sequelize } = require('../models');
const { Op } = require('sequelize');
const AppError = require('../utils/AppError');
const WechatPayV3Service = require('../utils/WechatPayV3Service');
const WechatPayV3Service = require('../utils/WechatPayV3Service');

/**
 * 生成唯一订单号
 * 格式：WO + 时间戳 + 4位随机数
 * @returns {string} 订单号
 */
const generateOrderNo = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WO${timestamp}${random}`;
};

class OrderController {
  /**
   * 创建工单
   * @route POST /api/orders
   * @access 用户角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static createOrder(req, res, next) {
    // 重写为标准异步实现，使用 async/await
    (async () => {
      try {
        if (!req.user) {
          return res.error('未认证用户', 401);
        }
        if (req.user.current_role !== 'user') {
          return res.error('只有用户角色可以创建工单', 403);
        }

        const {
          service_type_id,
          title,
          description,
          images = [],
          contact_name,
          contact_phone,
          service_address,
          latitude,
          longitude,
          expected_time,
          budget_min,
          budget_max
        } = req.body;

        const serviceType = await ServiceType.findByPk(service_type_id);
        if (!serviceType) {
          return res.error('服务类型不存在', 400);
        }

        const order_no = generateOrderNo();
        const order = await sequelize.transaction(async (t) => {
          const created = await Order.create({
            order_no,
            user_id: req.user.id,
            service_type_id,
            title,
            description,
            images,
            contact_name,
            contact_phone,
            service_address: service_address,
            latitude,
            longitude,
            estimated_amount: budget_max || budget_min || 0,
            status: 'pending_payment'
          }, { transaction: t });

          await OrderStatusLog.create({
            order_id: created.id,
            to_status: 'pending_payment',
            operator_id: req.user.id,
            operator_type: 'user',
            remark: '工单创建成功，待支付预付款'
          }, { transaction: t });

          await Message.create({
            user_id: req.user.id,
            title: '工单创建成功',
            content: `您的工单 ${created.order_no} 已创建成功，请支付预付款以进入待接单。`,
            type: 'order',
            related_id: created.id,
            to_status: 'unread'
          }, { transaction: t });

          return created;
        });

        console.log('创建订单成功，order:', order);
        console.log('order.id:', order.id);
        console.log('order.order_no:', order.order_no);

        const responseData = {
          id: order.id,
          order_no: order.order_no
        };

        console.log('准备返回的数据:', responseData);
        console.log('数据类型检查 - id:', typeof order.id, 'order_no:', typeof order.order_no);

        return res.success(responseData, '工单创建成功');
      } catch (error) {
        next(error);
      }
    })();
  }

  /**
   * 获取工单列表
   * @route GET /api/orders
   * @access 所有已登录用户
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async getOrderList(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.current_role;
      const {
        page = 1,
        limit = 20,
        status,
        service_type_id,
        search,
        latitude,
        longitude,
        distance = 1000,
        my_orders = false
      } = req.query;

      // 安全审计日志
      console.log(`[SECURITY] 订单列表访问 - 用户ID: ${userId}, 角色: ${userRole}, 参数:`, {
        page, limit, status, service_type_id, search, my_orders,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });

      // 构建查询条件
      const where = {};
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);

      // 根据用户角色设置查询条件
      if (userRole === 'user') {
        // 普通用户只能查看自己的订单
        where.user_id = userId;
        console.log(`用户 ${userId} 查询自己的订单`);
      } else if (userRole === 'electrician') {
        if (my_orders === 'true' || my_orders === true) {
          // 电工查看自己接的订单
          where.electrician_id = userId;
          console.log(`电工 ${userId} 查询自己接的订单`);
        } else {
          // 电工默认只能看到待接单的工单
          where.status = 'pending';
          where.electrician_id = null;
          console.log(`电工 ${userId} 查询可接的待处理订单`);
        }
      } else if (userRole === 'admin') {
        // 管理员可以查看所有订单
        console.log(`管理员 ${userId} 查询所有订单`);
        // 管理员不添加用户过滤条件，可以查看所有订单
      } else {
        // 未知角色，拒绝访问
        console.warn(`未知用户角色 ${userRole}，用户ID: ${userId}`);
        throw new AppError('权限不足', 403);
      }

      // 按状态筛选
      if (status) {
        where.status = status;
      }

      // 按服务类型筛选
      if (service_type_id) {
        where.service_type_id = parseInt(service_type_id);
      }

      // 按关键词搜索
      if (search) {
        where[sequelize.Op.or] = [
          { title: { [sequelize.Op.like]: `%${search}%` } },
          { description: { [sequelize.Op.like]: `%${search}%` } },
          { order_no: { [sequelize.Op.like]: `%${search}%` } }
        ];
      }

      // 按地理位置筛选（暂时禁用，避免查询错误）
      // TODO: 后续实现完整的地理位置筛选功能
      let geoFilter = {};
      // 暂时注释掉地理位置筛选逻辑
      /*
      if (latitude && longitude && distance) {
        // 这里可以根据实际需求实现地理位置筛选
        // 简化处理，实际应使用地理空间查询
      }
      */

      // 执行分页查询
      const { count, rows } = await Order.findAndCountAll({
        where: { ...where, ...geoFilter },
        include: [
          { model: User, as: 'user', attributes: ['id', 'nickname', 'avatar'] },
          { model: User, as: 'electrician', attributes: ['id', 'nickname', 'avatar'] },
          { model: ServiceType, as: 'serviceType' }
        ],
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize
      });

      // 预取本页订单的支付与评价信息，避免N+1查询
      const orderIds = rows.map(o => o.id);
      const repairPaidMap = new Map();
      const hasReviewSet = new Set();
      const prepayPaidMap = new Map();
      if (orderIds.length > 0) {
        // 维修费支付成功
        const repairPaidPayments = await Payment.findAll({
          where: { order_id: { [Op.in]: orderIds }, type: 'repair', status: 'success' },
          attributes: ['order_id', 'paid_at'],
          order: [['paid_at', 'DESC']]
        });
        repairPaidPayments.forEach(p => {
          const oid = p.order_id;
          if (!repairPaidMap.has(oid)) {
            repairPaidMap.set(oid, p.paid_at || null);
          }
        });

        // 预付款支付成功（冗余检查），虽然订单表有 prepaid_at，这里仍兼容以支付表为准
        const prepayPaidPayments = await Payment.findAll({
          where: { order_id: { [Op.in]: orderIds }, type: 'prepay', status: 'success' },
          attributes: ['order_id', 'paid_at'],
          order: [['paid_at', 'DESC']]
        });
        prepayPaidPayments.forEach(p => {
          const oid = p.order_id;
          if (!prepayPaidMap.has(oid)) {
            prepayPaidMap.set(oid, p.paid_at || null);
          }
        });

        // 是否存在评价
        const reviews = await Review.findAll({
          where: { order_id: { [Op.in]: orderIds } },
          attributes: ['order_id']
        });
        reviews.forEach(r => hasReviewSet.add(r.order_id));
      }

      // 处理图片字段
      const orders = rows.map(order => {
        const plainOrder = order.get({ plain: true });
        try {
          // 如果 images 字段存在且不为空，则进行 JSON 解析
          plainOrder.images = plainOrder.images ? JSON.parse(plainOrder.images) : [];
        } catch (error) {
          // 解析失败时设置为空数组并记录日志
          console.error(`Order ${plainOrder.id} has invalid images JSON: ${plainOrder.images}`);
          plainOrder.images = [];
        }

        // 派生字段：是否已支付维修费及支付时间
        plainOrder.has_paid_repair = repairPaidMap.has(plainOrder.id);
        plainOrder.repair_paid_at = repairPaidMap.get(plainOrder.id) || null;

        // 派生字段：是否已支付预付款及支付时间（优先使用订单表的 prepaid_at）
        plainOrder.has_paid_prepay = !!plainOrder.prepaid_at || prepayPaidMap.has(plainOrder.id);
        plainOrder.prepay_paid_at = plainOrder.prepaid_at || prepayPaidMap.get(plainOrder.id) || null;

        // 派生字段：是否已有评价
        plainOrder.has_review = hasReviewSet.has(plainOrder.id);

        // 展示层状态映射（不改变数据库枚举）
        const st = plainOrder.status;
        let displayCode = 'unknown';
        let displayText = '未知状态';

        // 交易关闭类
        if (st === 'cancelled' || st === 'closed') {
          displayCode = 'closed';
          displayText = '交易关闭';
        } else if (st === 'cancel_pending') {
          displayCode = 'cancel_pending';
          displayText = '交易关闭（取消处理中）';
        }
        // 待支付预付款
        else if (st === 'pending_payment' || (st === 'pending' && !plainOrder.has_paid_prepay)) {
          displayCode = 'prepay_pending';
          displayText = '待支付预付款';
        }
        // 待接单（已支付预付款，且未分配电工）
        else if (st === 'pending' && plainOrder.has_paid_prepay && !plainOrder.electrician_id) {
          displayCode = 'waiting_accept';
          displayText = '待接单';
        }
        // 已接单（accepted），如已填写金额/维修内容但未支付维修费，则仍显示“待支付维修费”
        else if (st === 'accepted') {
          const needRepairPay = ((plainOrder.final_amount && Number(plainOrder.final_amount) > 0) || !!plainOrder.repair_content) && !plainOrder.has_paid_repair;
          if (needRepairPay) {
            displayCode = 'repair_pay_pending';
            displayText = '待支付维修费';
          } else {
            displayCode = 'accepted';
            displayText = '已接单';
          }
        }
        // 待支付维修费阶段
        else if (st === 'pending_repair_payment') {
          if (!plainOrder.has_paid_repair) {
            displayCode = 'repair_pay_pending';
            displayText = '待支付维修费';
          } else {
            // 如果用户已支付维修费，但状态尚未切到 in_progress，由电工通过开始维修接口进行转换
            displayCode = 'in_progress';
            displayText = '维修中';
          }
        }
        // 维修中
        else if (st === 'in_progress') {
          displayCode = 'in_progress';
          displayText = '维修中';
        }
        // 已完成/待评价
        else if (st === 'completed') {
          if (plainOrder.has_review) {
            displayCode = 'completed';
            displayText = '已完成';
          } else {
            displayCode = 'pending_review';
            displayText = '待评价';
          }
        }

        plainOrder.display_status = displayCode;
        plainOrder.display_status_text = displayText;
        return plainOrder;
      });

      // 安全审计日志 - 记录查询结果
      console.log(`[SECURITY] 订单查询结果 - 用户ID: ${userId}, 角色: ${userRole}, 返回订单数: ${count}, 实际返回: ${orders.length}`);

      // 返回分页结果
      res.success({
        total: count,
        page: pageNumber,
        limit: pageSize,
        pages: Math.ceil(count / pageSize),
        list: orders
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取工单详情
   * @route GET /api/orders/:id
   * @access 所有已登录用户
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async getOrderDetail(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.current_role;

      // 查询工单详情（包含关联数据）
      const order = await Order.findByPk(id, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'nickname', 'avatar', 'phone'] },
          { model: User, as: 'electrician', attributes: ['id', 'nickname', 'avatar', 'phone'] },
          { model: ServiceType, as: 'serviceType' },
          { model: Review, as: 'review' },
          // 修正别名为定义的 'status_logs'，并暂时移除未定义的 operator 关联
          { model: OrderStatusLog, as: 'status_logs' }
        ]
      });

      // 检查工单是否存在
      if (!order) {
        throw new AppError('工单不存在', 404);
      }

      // 权限检查
      if (userRole === 'user' && order.user_id !== userId) {
        throw new AppError('无权查看此工单', 403);
      }

      if (userRole === 'electrician' &&
        order.electrician_id !== userId &&
        order.status !== 'pending') {
        throw new AppError('无权查看此工单', 403);
      }

      // 处理图片字段
      const orderData = order.get({ plain: true });
      // 安全处理 JSON 字段：Sequelize 的 JSON 类型可能已是数组，无需再解析
      if (Array.isArray(orderData.images)) {
        // 已是数组，保持不变
      } else if (typeof orderData.images === 'string') {
        try {
          orderData.images = JSON.parse(orderData.images);
        } catch (e) {
          orderData.images = [];
        }
      } else {
        orderData.images = orderData.images || [];
      }

      if (Array.isArray(orderData.repair_images)) {
        // 已是数组，保持不变
      } else if (typeof orderData.repair_images === 'string') {
        try {
          orderData.repair_images = JSON.parse(orderData.repair_images);
        } catch (e) {
          orderData.repair_images = [];
        }
      } else {
        orderData.repair_images = orderData.repair_images || [];
      }

      // 派生字段：是否已支付维修费及支付时间
      const repairPayment = await Payment.findOne({
        where: { order_id: order.id, type: 'repair', status: 'success' },
        order: [['paid_at', 'DESC']]
      });
      orderData.has_paid_repair = !!repairPayment;
      orderData.repair_paid_at = repairPayment ? repairPayment.paid_at : null;

      // ✅ 新增：派生字段：是否已支付预付款及支付时间
      const prepayPayment = await Payment.findOne({
        where: { order_id: order.id, type: 'prepay', status: 'success' },
        order: [['paid_at', 'DESC']]
      });
      orderData.has_paid_prepay = !!orderData.prepaid_at || !!prepayPayment;
      orderData.prepay_paid_at = orderData.prepaid_at || (prepayPayment ? prepayPayment.paid_at : null);

      res.success({ order: orderData });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 电工抢单
   * @route POST /api/orders/:id/take
   * @access 电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async takeOrder(req, res, next) {
    try {
      const { id } = req.params;
      const electricianId = req.user.id;
      const now = new Date();

      // 验证电工角色
      if (req.user.current_role !== 'electrician') {
        throw new AppError('只有电工可以抢单', 403);
      }

      // 验证电工认证状态
      const electrician = await User.findByPk(electricianId);
      if (!electrician || electrician.status !== 'active') {
        throw new AppError('您的账号未激活，无法接单', 403);
      }

      // 查询工单
      const order = await Order.findByPk(id);
      if (!order) {
        throw new AppError('工单不存在', 404);
      }

      // 验证工单状态
      if (order.status !== 'pending') {
        throw new AppError(`工单当前状态为 ${order.status}，无法接单`, 400);
      }

      // 使用事务更新工单状态
      await sequelize.transaction(async (t) => {
        // 准备更新数据
        const updateData = {
          electrician_id: electricianId,
          status: 'accepted',
          accepted_at: now
        };

        // 更新工单
        await order.update(updateData, { transaction: t });

        // 创建状态日志
        await OrderStatusLog.create({
          order_id: order.id,
          to_status: 'accepted',
          operator_id: electricianId,
          operator_type: 'electrician',
          remark: '电工接单',
          created_at: now
        }, { transaction: t });

        // 创建消息通知用户
        await Message.create({
          user_id: order.user_id,
          title: '工单已被接单',
          content: `您的工单 ${order.order_no} 已被电工接单，请及时确认`,
          type: 'order',
          reference_id: order.id,
          is_read: false,
          created_at: now
        }, { transaction: t });

        // ==========================================
        // TEST START: 临时测试自动转账功能 (复制自 reviewOrder)
        // ==========================================
        try {
          console.log('触发测试转账逻辑...');
          // 1. 获取电工信息（OpenID）
          const electrician = await User.findByPk(electricianId);
          
          if (electrician && electrician.openid) {
            console.log(`电工OpenID: ${electrician.openid}`);
            // 2. 计算转账金额（统计该订单所有成功支付的金额：预付款+维修费）
            // 注意：接单时刻通常只有预付款
            const paidPayments = await Payment.findAll({
              where: {
                order_id: order.id,
                status: 'success',
                type: { [Op.in]: ['prepay', 'repair'] }
              }
            });

            const totalAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            console.log(`待转账总金额: ${totalAmount}`);

            if (totalAmount > 0) {
              // 3. 发起转账
              const wechatPayService = new WechatPayV3Service();
              const transferResult = await wechatPayService.createTransfer({
                out_batch_no: `TR_${order.order_no}_${Date.now()}`,
                batch_name: `订单${order.order_no}结算(测试)`,
                batch_remark: '接单即转账测试',
                total_amount: totalAmount,
                openid: electrician.openid
              });

              if (transferResult.success) {
                console.log('转账成功');
                
                // 记录转账记录
                await Payment.create({
                  order_id: order.id,
                  user_id: order.user_id, // 记录为用户发起的（间接）
                  amount: totalAmount,
                  payment_method: 'wechat',
                  type: 'transfer',
                  status: 'success',
                  out_trade_no: transferResult.out_batch_no, // 使用批次号作为订单号
                  transaction_id: transferResult.batch_id,
                  paid_at: now
                }, { transaction: t });

                // 更新订单状态为已结算 (覆盖 accepted)
                await order.update({
                  status: 'settled',
                  completed_at: now // 视为完成
                }, { transaction: t });

                await OrderStatusLog.create({
                  order_id: order.id,
                  from_status: 'accepted',
                  to_status: 'settled',
                  operator_id: electricianId,
                  operator_type: 'electrician',
                  remark: '测试转账成功，自动结算'
                }, { transaction: t });

              } else {
                 console.error('转账API返回失败');
              }
            } else {
              console.warn(`订单 ${order.id} 支付总额为0，跳过转账`);
            }
          } else {
            console.warn(`电工 ${electricianId} 未绑定OpenID，无法转账`);
          }
        } catch (transferError) {
          console.error('自动转账失败:', transferError);
          // 不阻断接单流程
        }
        // ==========================================
        // TEST END
        // ==========================================
      });

      res.success({
        message: '接单成功，请核实服务地址'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 开始维修（电工端）
   * @route PUT /api/orders/:id/start
   * @access 电工
   */
  static async startOrder(req, res, next) {
    try {
      const { id } = req.params;
      const electricianId = req.user.id;

      // 查询工单
      const order = await Order.findByPk(id);
      if (!order) {
        throw new AppError('工单不存在', 404);
      }

      // 角色与归属校验
      if (req.user.current_role !== 'electrician') {
        throw new AppError('只有电工可以开始维修', 403);
      }
      if (order.electrician_id !== electricianId) {
        throw new AppError('只有接单电工可开始维修', 403);
      }

      // 幂等：已在维修中则直接返回
      if (order.status === 'in_progress') {
        return res.success({ message: '订单已在维修中', order_id: order.id, status: order.status });
      }

      // 状态前置条件校验
      if (order.status !== 'pending_repair_payment') {
        throw new AppError('当前状态不可开始维修', 400);
      }

      // 校验维修费支付成功（派生判断）
      const repairPayment = await Payment.findOne({
        where: { order_id: order.id, type: 'repair', status: 'success' },
        order: [['paid_at', 'DESC']]
      });
      if (!repairPayment) {
        throw new AppError('维修费未支付，无法开始维修', 400);
      }

      // 条件更新防并发：仅当仍为 pending_repair_payment 时切换为 in_progress
      const [affected] = await Order.update(
        { status: 'in_progress' },
        { where: { id: order.id, status: 'pending_repair_payment' } }
      );
      if (affected === 0) {
        // 重新读取状态用于幂等处理
        const latest = await Order.findByPk(order.id);
        if (latest && latest.status === 'in_progress') {
          return res.success({ message: '订单已在维修中', order_id: latest.id, status: latest.status });
        }
        throw new AppError('状态已变更，开始维修失败，请重试', 409);
      }

      // 记录状态日志与通知消息
      await OrderStatusLog.create({
        order_id: order.id,
        from_status: 'pending_repair_payment',
        to_status: 'in_progress',
        operator_id: electricianId,
        operator_type: 'electrician',
        remark: '电工开始维修'
      });
      await Message.create({
        user_id: order.user_id,
        title: '订单开始维修',
        content: `您的工单 ${order.order_no} 已开始维修。`,
        type: 'order',
        related_id: order.id,
        to_status: 'unread'
      });

      res.success({ message: '已开始维修', order_id: order.id, status: 'in_progress' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 完成工单
   * @route POST /api/orders/:id/complete
   * @access 电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async completeOrder(req, res, next) {
    try {
      const { id } = req.params;
      // 兼容两种参数名称
      const repair_content = req.body.repair_content || req.body.completion_note || null;

      // 处理图片参数，确保是数组
      let repair_images = [];
      if (req.body.repair_images && Array.isArray(req.body.repair_images)) {
        repair_images = req.body.repair_images;
      } else if (req.body.completion_images && Array.isArray(req.body.completion_images)) {
        repair_images = req.body.completion_images;
      }
      const electricianId = req.user.id;
      const now = new Date();

      // 验证电工角色
      if (req.user.current_role !== 'electrician') {
        throw new AppError('只有电工可以完成工单', 403);
      }

      // 查询工单
      const order = await Order.findByPk(id);
      if (!order) {
        throw new AppError('工单不存在', 404);
      }

      // 验证是否是工单的电工
      if (order.electrician_id !== electricianId) {
        throw new AppError('无权操作此工单', 403);
      }

      // 验证工单状态：仅允许进行中状态完成服务
      if (order.status !== 'in_progress') {
        throw new AppError(`工单当前状态为 ${order.status}，无法完成服务`, 400);
      }

      // 使用事务更新工单状态
      await sequelize.transaction(async (t) => {
        // 更新工单
        const updateData = {
          status: 'pending_review',
          completed_at: now
        };

        // 只有当提供了维修内容时才更新
        if (repair_content !== null) {
          updateData.repair_content = repair_content;
        }

        // 只有当提供了维修图片时才更新
        if (repair_images.length > 0) {
          updateData.repair_images = JSON.stringify(repair_images);
        }

        await order.update(updateData, { transaction: t });

        // 创建状态日志：进入待评价
        await OrderStatusLog.create({
          order_id: order.id,
          from_status: order.status,
          to_status: 'pending_review',
          operator_id: electricianId,
          operator_type: 'electrician',
          remark: '电工完成服务，待用户评价',
          created_at: now
        }, { transaction: t });

        // 创建消息通知用户
        await Message.create({
          user_id: order.user_id,
          title: '工单待评价',
          content: `您的工单 ${order.order_no} 电工已完成服务，请前往评价。`,
          type: 'order',
          reference_id: order.id,
          is_read: false,
          created_at: now
        }, { transaction: t });
      });

      res.success({
        message: '服务已完成，订单进入待评价'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户评价订单
   * @route PUT /api/orders/:id/review
   * @access 用户角色
   */
  static async reviewOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user?.id;
      const now = new Date();

      if (!req.user) {
        return res.error('未认证用户', 401);
      }
      if (req.user.current_role !== 'user') {
        return res.error('只有用户可以评价订单', 403);
      }

      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }
      if (order.user_id !== userId) {
        return res.error('无权操作此工单', 403);
      }
      if (order.status !== 'pending_review') {
        return res.error('当前状态不允许评价，需为待评价', 400);
      }

      // 开始事务并更新评价与状态
      const transaction = await sequelize.transaction();
      let transferSuccess = false; // 标记转账是否成功

      try {
        let nextStatus = 'completed';
        let statusRemark = '用户完成评价，订单已完成';

        // 5星评价且有电工接单 -> 触发转账
        if (Number(rating) === 5 && order.electrician_id) {
          try {
            // 1. 获取电工信息（OpenID）
            const electrician = await User.findByPk(order.electrician_id);
            if (electrician && electrician.openid) {
              // 2. 计算转账金额（统计该订单所有成功支付的金额：预付款+维修费）
              const paidPayments = await Payment.findAll({
                where: {
                  order_id: order.id,
                  status: 'success',
                  type: { [Op.in]: ['prepay', 'repair'] }
                }
              });

              const totalAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

              if (totalAmount > 0) {
                // 3. 发起转账
                const wechatPayService = new WechatPayV3Service();
                const transferResult = await wechatPayService.createTransfer({
                  out_batch_no: `TR_${order.order_no}_${Date.now()}`,
                  batch_name: `订单${order.order_no}结算`,
                  batch_remark: '用户五星好评自动结算',
                  total_amount: totalAmount,
                  openid: electrician.openid
                });

                if (transferResult.success) {
                  // 转账成功，状态改为已结算
                  nextStatus = 'settled';
                  statusRemark = '用户五星好评，系统自动转账成功，订单已结算';
                  transferSuccess = true;

                  // 记录转账记录
                  await Payment.create({
                    order_id: order.id,
                    user_id: order.user_id, // 记录为用户发起的（间接）
                    amount: totalAmount,
                    payment_method: 'wechat',
                    type: 'transfer',
                    status: 'success',
                    out_trade_no: transferResult.out_batch_no, // 使用批次号作为订单号
                    transaction_id: transferResult.batch_id,
                    paid_at: now
                  }, { transaction });
                }
              } else {
                console.warn(`订单 ${order.id} 支付总额为0，跳过转账`);
              }
            } else {
              console.warn(`电工 ${order.electrician_id} 未绑定OpenID，无法转账`);
            }
          } catch (transferError) {
            console.error('自动转账失败:', transferError);
            // 转账失败，状态保持 completed，记录错误日志，不阻断评价流程
            // 可以在此处记录系统消息通知管理员或记录专门的错误日志表
          }
        }

        await order.update({
          status: nextStatus,
          completed_at: now,
          reviewed_at: now
        }, { transaction });

        // 创建评价记录（用于电工评分统计等）
        await Review.create({
          order_id: order.id,
          user_id: userId,
          electrician_id: order.electrician_id,
          rating,
          content: comment || null
        }, { transaction });

        await OrderStatusLog.create({
          order_id: order.id,
          from_status: 'pending_review',
          to_status: nextStatus,
          operator_id: userId,
          operator_type: 'user',
          remark: statusRemark
        }, { transaction });

        // 通知电工订单完成且用户已评价
        if (order.electrician_id) {
          const msgContent = transferSuccess
            ? `工单 ${order.order_no} 用户五星好评，资金已自动结算至您的零钱。`
            : `工单 ${order.order_no} 用户已完成评价，订单关闭。`;

          await Message.create({
            user_id: order.electrician_id,
            title: transferSuccess ? '订单已结算' : '订单已完成',
            content: msgContent,
            type: 'order',
            reference_id: order.id,
            is_read: false,
            created_at: now
          }, { transaction });
        }

        await transaction.commit();
        return res.success({
          message: transferSuccess ? '评价成功，资金已结算给电工' : '评价成功，订单已完成',
          order_id: order.id
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消工单
   * @route POST /api/orders/:id/cancel
   * @access 用户、电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { cancel_reason } = req.body;
      const userId = req.user.id;
      const now = new Date();

      // 验证用户角色
      if (req.user.current_role !== 'user') {
        throw new AppError('只有用户可以取消工单', 403);
      }

      // 查询工单
      const order = await Order.findByPk(id);
      if (!order) {
        throw new AppError('工单不存在', 404);
      }

      // 验证是否是工单的用户
      if (order.user_id !== userId) {
        throw new AppError('无权操作此工单', 403);
      }

      // 验证工单状态
      const validStatuses = ['pending', 'accepted'];
      if (!validStatuses.includes(order.status)) {
        throw new AppError(`工单当前状态为 ${order.status}，无法取消`, 400);
      }

      // 使用事务更新工单状态
      await sequelize.transaction(async (t) => {
        // 更新工单
        await order.update({
          status: 'cancelled',
          cancelled_at: now,
          cancel_reason
        }, { transaction: t });

        // 创建状态日志
        await OrderStatusLog.create({
          order_id: order.id,
          status: 'cancelled',
          operator_id: userId,
          operator_role: 'user',
          remark: `用户取消工单，原因: ${cancel_reason}`,
          created_at: now
        }, { transaction: t });

        // 如果已有电工接单，则通知电工
        if (order.electrician_id) {
          await Message.create({
            user_id: order.electrician_id,
            title: '工单已取消',
            content: `工单 ${order.order_no} 已被用户取消，原因: ${cancel_reason}`,
            type: 'order',

            created_at: now
          }, { transaction: t });
        }
      });

      res.success({
        message: '工单已取消'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户确认工单
   * @route PUT /api/orders/:id/confirm
   * @access 用户角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async confirmOrder(req, res, next) {
    (async () => {
      try {
        const { id } = req.params;
        const { confirmed } = req.body;

        // 确保用户已登录且为用户角色
        if (!req.user) {
          return res.error('未认证用户', 401);
        }
        if (req.user.current_role !== 'user') {
          return res.error('只有用户角色可以确认工单', 403);
        }

        // 查找工单
        const order = await Order.findByPk(id);
        if (!order) {
          return res.error('工单不存在', 404);
        }

        // 验证工单所有权
        if (order.user_id !== req.user.id) {
          return res.error('无权操作此工单', 403);
        }

        // 验证工单状态
        if (order.status !== 'accepted') {
          return res.error('只有已接单状态的工单可以确认', 400);
        }

        // 开始事务
        const transaction = await sequelize.transaction();

        try {
          // 更新工单状态为进行中
          await order.update({
            status: 'in_progress',
            confirmed_at: new Date()
          }, { transaction });

          // 记录状态变更日志
          await OrderStatusLog.create({
            order_id: order.id,
            from_status: 'accepted',
            to_status: 'in_progress',
            operator_id: req.user.id,
            operator_type: 'user',
            operator_role: 'user',
            remark: '用户确认工单，开始服务'
          }, { transaction });

          // 提交事务
          await transaction.commit();

          return res.success({
            message: '工单确认成功',
            order_id: order.id
          });
        } catch (error) {
          // 回滚事务
          await transaction.rollback();
          throw error;
        }
      } catch (error) {
        next(error);
      }
    })();
  }

  /**
   * 电工修改订单内容和金额
   * @route PUT /api/orders/:id/update
   * @access 电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async updateOrderByElectrician(req, res, next) {
    try {
      const { id } = req.params;
      const { title, description, amount, remark, repair_content, repair_images } = req.body;

      // 确保用户已登录且为电工角色
      if (!req.user) {
        return res.error('未认证用户', 401);
      }
      if (req.user.current_role !== 'electrician') {
        return res.error('只有电工角色可以修改订单', 403);
      }

      // 查找工单
      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 验证电工是否为该工单的负责人
      if (order.electrician_id !== req.user.id) {
        return res.error('您不是该工单的负责电工', 403);
      }

      // 验证工单状态：允许已接单、待支付维修费、维修中
      const allowedStatuses = ['accepted', 'pending_repair_payment', 'in_progress'];
      if (!allowedStatuses.includes(order.status)) {
        return res.error('只有已接单或待支付维修费状态的工单可以修改', 400);
      }

      // 开始事务
      const transaction = await sequelize.transaction();

      try {
        // 更新工单信息
        const updateData = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (amount !== undefined) updateData.final_amount = amount;

        // 写入维修内容与图片（如提供）
        if (repair_content) updateData.repair_content = repair_content;
        if (Array.isArray(repair_images) && repair_images.length > 0) {
          updateData.repair_images = JSON.stringify(repair_images);
        }

        // 设置为待支付维修费状态
        updateData.status = 'pending_repair_payment';
        // 不再需要用户确认，直接进入待支付
        updateData.needs_confirmation = false;

        // 记录原状态用于日志
        const prevStatus = order.status;

        await order.update(updateData, { transaction });

        // 记录状态变更日志
        await OrderStatusLog.create({
          order_id: order.id,
          from_status: prevStatus,
          to_status: 'pending_repair_payment',
          operator_id: req.user.id,
          operator_type: 'electrician',
          operator_role: 'electrician',
          remark: remark || '电工更新了维修内容与金额，进入待支付维修费'
        }, { transaction });

        // 提交事务
        await transaction.commit();

        return res.success({
          message: '维修金额已确认，等待用户支付',
          order_id: order.id
        });
      } catch (error) {
        // 回滚事务
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户确认订单内容和金额
   * @route POST /api/orders/:id/confirm-update
   * @access 用户角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async confirmOrderUpdate(req, res, next) {
    try {
      const { id } = req.params;

      // 确保用户已登录且为用户角色
      if (!req.user) {
        return res.error('未认证用户', 401);
      }
      if (req.user.current_role !== 'user') {
        return res.error('只有用户角色可以确认订单修改', 403);
      }

      // 查找工单
      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 验证工单所有权
      if (order.user_id !== req.user.id) {
        return res.error('无权操作此工单', 403);
      }

      // 验证工单状态
      if (order.status !== 'in_progress' && order.status !== 'accepted') {
        return res.error('只有已接单或进行中状态的工单可以确认修改', 400);
      }

      // 验证是否需要确认
      if (!order.needs_confirmation) {
        return res.error('当前订单没有待确认的修改', 400);
      }

      // 开始事务
      const transaction = await sequelize.transaction();

      try {
        // 更新工单状态
        await order.update({
          needs_confirmation: false,
          confirmed_at: new Date()
        }, { transaction });

        // 记录状态变更日志
        await OrderStatusLog.create({
          order_id: order.id,
          from_status: 'in_progress',
          to_status: 'in_progress',
          operator_id: req.user.id,
          operator_type: 'user',
          operator_role: 'user',
          remark: '用户确认了订单修改'
        }, { transaction });

        // 提交事务
        await transaction.commit();

        return res.success({
          message: '订单修改确认成功',
          order_id: order.id
        });
      } catch (error) {
        // 回滚事务
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 发起取消订单
   * @route POST /api/orders/:id/initiate-cancel
   * @access 用户、电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async initiateCancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // 确保用户已登录
      if (!req.user) {
        return res.error('未认证用户', 401);
      }

      // 验证用户角色
      if (!['user', 'electrician'].includes(req.user.current_role)) {
        return res.error('无权操作', 403);
      }

      // 查找工单
      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 验证操作权限
      if (req.user.current_role === 'user' && order.user_id !== req.user.id) {
        return res.error('无权操作此工单', 403);
      }

      if (req.user.current_role === 'electrician' && order.electrician_id !== req.user.id) {
        return res.error('无权操作此工单', 403);
      }

      // 验证工单状态
      // 用户可以取消待接单、已接单和进行中的订单，电工可以取消已接单和进行中的订单
      if (req.user.current_role === 'user') {
        if (order.status !== 'pending' && order.status !== 'accepted' && order.status !== 'in_progress') {
          return res.error('只有待接单、已接单或进行中状态的工单可以发起取消', 400);
        }
      } else if (order.status !== 'accepted' && order.status !== 'in_progress') {
        return res.error('只有已接单或进行中状态的工单可以发起取消', 400);
      }

      // 检查是否已经有取消请求
      if (order.status === 'cancel_pending') {
        return res.error('该工单已有取消请求，等待对方确认', 400);
      }

      // 开始事务
      const transaction = await sequelize.transaction();

      try {
        // 如果是用户取消待接单状态的订单，直接取消
        if (req.user.current_role === 'user' && order.status === 'pending') {
          // 直接更新为已取消状态
          await order.update({
            status: 'cancelled',
            cancel_reason: reason,
            cancelled_at: new Date()
          }, { transaction });

          // 记录状态变更日志
          await OrderStatusLog.create({
            order_id: order.id,
            from_status: order.status,
            to_status: 'cancelled',
            operator_id: req.user.id,
            operator_type: req.user.current_role,
            remark: `${req.user.current_role === 'user' ? '用户' : '电工'}取消了待接单状态的订单：${reason}`
          }, { transaction });

          // 提交事务
          await transaction.commit();

          return res.success({
            message: '订单已取消',
            order_id: order.id
          });
        } else {
          // 已接单或进行中状态需要发起取消请求
          await order.update({
            status: 'cancel_pending',
            cancel_initiator_id: req.user.id,
            cancel_reason: reason,
            cancel_initiated_at: new Date(),
            cancel_confirm_status: 'pending'
          }, { transaction });

          // 记录状态变更日志
          await OrderStatusLog.create({
            order_id: order.id,
            from_status: order.status,
            to_status: order.status,
            operator_id: req.user.id,
            operator_type: req.user.current_role,
            remark: `${req.user.current_role === 'user' ? '用户' : '电工'}发起取消订单请求：${reason}`
          }, { transaction });

          // 提交事务
          await transaction.commit();

          return res.success({
            message: '取消订单请求已发起，等待对方确认',
            order_id: order.id
          });
        }
      } catch (error) {
        // 回滚事务
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 确认取消订单
   * @route POST /api/orders/:id/confirm-cancel
   * @access 用户、电工角色
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件
   */
  static async confirmCancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { cancel_reason } = req.body;

      // 确保用户已登录
      if (!req.user) {
        return res.error('未认证用户', 401);
      }

      // 验证用户角色
      if (!['user', 'electrician'].includes(req.user.current_role)) {
        return res.error('无权操作', 403);
      }

      // 查找工单
      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 验证操作权限
      if (req.user.current_role === 'user' && order.user_id !== req.user.id) {
        return res.error('无权操作此工单', 403);
      }

      if (req.user.current_role === 'electrician' && order.electrician_id !== req.user.id) {
        return res.error('无权操作此工单', 403);
      }

      // 验证工单状态
      if (order.status !== 'cancel_pending') {
        return res.error('只有处于待确认取消状态的工单可以确认取消', 400);
      }

      // 验证确认方不是发起方
      if (order.cancel_initiator_id === req.user.id) {
        return res.error('您是取消请求的发起方，无需再次确认', 400);
      }

      // 开始事务
      const transaction = await sequelize.transaction();

      try {
        // 更新工单状态为已取消
        await order.update({
          status: 'cancelled',
          cancel_confirm_status: 'confirmed',
          cancel_confirmed_at: new Date(),
          cancel_confirmer_id: req.user.id,
          cancel_reason: cancel_reason || order.cancel_reason, // 使用传入的取消原因或保留原有原因
          cancelled_at: new Date() // 设置取消时间
        }, { transaction });

        // 记录状态变更日志
        await OrderStatusLog.create({
          order_id: order.id,
          from_status: 'in_progress',
          to_status: 'cancelled',
          operator_id: req.user.id,
          operator_type: req.user.current_role,
          operator_role: req.user.current_role,
          remark: `${req.user.current_role === 'user' ? '用户' : '电工'}确认取消订单：${cancel_reason}`
        }, { transaction });

        // 提交事务
        await transaction.commit();

        return res.success({
          message: '订单已成功取消',
          order_id: order.id
        });
      } catch (error) {
        // 回滚事务
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;