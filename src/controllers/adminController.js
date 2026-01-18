/**
 * 管理后台控制器
 * 处理管理员相关的业务逻辑
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
// 导入模型
const Admin = require('../models/Admin');
const User = require('../models/User');
const ElectricianCertification = require('../models/ElectricianCertification');
const Order = require('../models/Order');
const ServiceType = require('../models/ServiceType');
const SystemMessage = require('../models/SystemMessage');

class AdminController {
  // 管理员登录
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      console.log('登录请求:', { username, password });

      // 查询管理员
      const admin = await Admin.findOne({
        where: {
          username,
          status: 'active'
        }
      });
      
      console.log('查询到的管理员:', admin ? 1 : 0);

      if (!admin) {
        console.log('管理员不存在');
        return res.error('用户名或密码错误', 401);
      }

      console.log('管理员信息:', { id: admin.id, username: admin.username, passwordHash: admin.password });

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, admin.password);
      console.log('密码验证结果:', isValidPassword);
      if (!isValidPassword) {
        console.log('密码验证失败');
        return res.error('用户名或密码错误', 401);
      }

      // 生成JWT token
      const token = jwt.sign(
        { 
          id: admin.id, 
          username: admin.username,
          type: 'admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // 更新最后登录时间
      admin.last_login_at = new Date();
      await admin.save();

      res.success({
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          real_name: admin.real_name,
          email: admin.email
        }
      }, '登录成功');
    } catch (error) {
      console.error('管理员登录错误:', error);
      res.error('登录失败');
    }
  }

  // 获取管理员信息
  static async getAdminInfo(req, res) {
    try {
      const adminId = req.user.id;
      
      const admin = await Admin.findByPk(adminId, {
        attributes: ['id', 'username', 'real_name', 'email', 'created_at']
      });

      if (!admin) {
        return res.error('管理员不存在', 404);
      }

      res.success(admin);
    } catch (error) {
      console.error('获取管理员信息错误:', error);
      res.error('获取信息失败');
    }
  }

  // 管理员登出
  static async logout(req, res) {
    try {
      // 这里可以实现token黑名单机制
      res.success(null, '登出成功');
    } catch (error) {
      console.error('管理员登出错误:', error);
      res.error('登出失败');
    }
  }

  // 获取用户列表
  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      console.log('开始获取用户列表，参数:', { page, limit, search, status });

      // 构建查询条件
      const where = {};
      
      if (status) {
        where.status = status;
      }
      
      if (search) {
        where[Op.or] = [
          { phone: { [Op.like]: `%${search}%` } },
          { nickname: { [Op.like]: `%${search}%` } }
        ];
      }

      console.log('执行用户查询...');
      // 使用Sequelize查询用户列表
      const { count, rows: users } = await User.findAndCountAll({
        where,
        attributes: ['id', 'phone', 'nickname', 'current_role', 'status', 'created_at', 'last_login_at','can_be_electrician'],
        order: [['id', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
      console.log('用户查询完成，结果数量:', users.length);
      console.log('计数查询完成，总数:', count);

      res.success({
        users,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('获取用户列表错误:', error);
      res.error('获取用户列表失败');
    }
  }

  // 获取用户详情
  static async getUserDetail(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);

      if (!user) {
        return res.error('用户不存在', 404);
      }

      res.success(user);
    } catch (error) {
      console.error('获取用户详情错误:', error);
      res.error('获取用户详情失败');
    }
  }

  // 封禁/解封用户
  static async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, reason = '' } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.error('用户不存在', 404);
      }
      
      user.status = status;
      user.ban_reason = reason;
      await user.save();

      res.success(null, `用户${status === 'banned' ? '封禁' : '解封'}成功`);
    } catch (error) {
      console.error('更新用户状态错误:', error);
      res.error('操作失败');
    }
  }

  // 获取电工列表
  static async getElectricians(req, res) {
    try {
      const { page = 1, limit = 20, keyword = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      // 构建查询条件
      const certWhere = {};
      const userWhere = {};
      
      // 认证状态条件
      if (status && status.trim() !== '') {
        certWhere.status = status;
      }
      
      // 搜索条件 - 支持搜索真实姓名和手机号
      if (keyword && keyword.trim() !== '') {
        const searchTerm = keyword.trim();
        certWhere[Op.or] = [
          { real_name: { [Op.like]: `%${searchTerm}%` } }
        ];
        userWhere[Op.or] = [
          { phone: { [Op.like]: `%${searchTerm}%` } }
        ];
      }
      
      // 查询电工认证记录，关联用户信息
      const { count, rows: certifications } = await ElectricianCertification.findAndCountAll({
        where: certWhere,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'phone', 'nickname', 'avatar', 'status', 'created_at'],
            where: Object.keys(userWhere).length ? userWhere : undefined,
            required: true
          }
        ],
        order: [['created_at', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
      // 格式化结果，映射字段名称
      const electricians = certifications.map(cert => {
        const plainCert = cert.get({ plain: true });
        const userInfo = plainCert.user || {};
        
        // 添加调试日志 2025.11.3
        console.log('=== 电工数据调试 ===');
        console.log('plainCert keys:', Object.keys(plainCert));
        console.log('userInfo:', userInfo);
        console.log('userInfo.phone:', userInfo.phone);
        console.log('==================');
        
        return {
          id: plainCert.id,
          user_id: plainCert.user_id,
          phone: userInfo.phone,
          real_name: plainCert.real_name,
          id_card: plainCert.id_card,
          electrician_license: plainCert.electrician_cert_no, // 映射字段名
          license_expiry: plainCert.cert_end_date, // 映射字段名
          status: plainCert.status,
          reject_reason: plainCert.reject_reason,
          created_at: plainCert.created_at,
          updated_at: plainCert.updated_at,
          // 用户相关信息
          user_status: userInfo.status,
          nickname: userInfo.nickname,
          avatar: userInfo.avatar
        };
      });
      
      res.success({
        list: electricians,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('获取电工列表错误:', error);
      res.error('获取电工列表失败');
    }
  }

  // 获取电工详情
  static async getElectricianDetail(req, res) {
    try {
      const { id } = req.params;

      // 直接查询电工认证记录
      const certification = await ElectricianCertification.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'phone', 'nickname', 'avatar', 'status', 'created_at']
        }]
      });

      if (!certification) {
        return res.error('电工认证记录不存在', 404);
      }

      // 格式化结果，映射字段名称
      const plainCert = certification.get({ plain: true });
      const userInfo = plainCert.User || {};
      
      const result = {
        id: plainCert.id,
        user_id: plainCert.user_id,
        phone: userInfo.phone,
        real_name: plainCert.real_name,
        id_card: plainCert.id_card,
        electrician_license: plainCert.electrician_cert_no, // 映射字段名
        license_expiry: plainCert.cert_end_date, // 映射字段名
        cert_start_date: plainCert.cert_start_date,
        status: plainCert.status,
        reject_reason: plainCert.reject_reason,
        created_at: plainCert.created_at,
        updated_at: plainCert.updated_at,
        approved_at: plainCert.approved_at,
        // 用户相关信息
        user_status: userInfo.status,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        user_created_at: userInfo.created_at,
        id_card_front: plainCert.id_card_front,
        id_card_back: plainCert.id_card_back,
        license_photo: plainCert.certificate_img
      };

      res.success(result);
    } catch (error) {
      console.error('获取电工详情错误:', error);
      res.error('获取电工详情失败');
    }
  }

  // 审核电工认证
  static async reviewElectrician(req, res) {
    try {
      const { id } = req.params;
      const { status, reason = '' } = req.body;

      // 直接通过认证记录ID查询
      const certification = await ElectricianCertification.findByPk(id);
      
      if (!certification) {
        return res.error('认证申请不存在', 404);
      }
      
      certification.status = status;
      if (status === 'rejected') {
        certification.reject_reason = reason;
      } else if (status === 'approved') {
        certification.approved_at = new Date();
        certification.reject_reason = null;
        
        // 同步更新用户表状态
        const user = await User.findByPk(certification.user_id);
        if (user) {
          await user.update({ 
            can_be_electrician: true,
            current_role: 'electrician'
          });
          console.log(`用户 ${user.id} 电工认证通过，已更新用户表角色为电工`);
        }
      }
      
      await certification.save();

      res.success(null, '审核完成');
    } catch (error) {
      console.error('审核电工错误:', error);
      res.error('审核失败');
    }
  }

  // 获取工单列表
  static async getOrders(req, res) {
    try {
      const { page = 1, limit = 20, search = '', status = '', service_type = '' } = req.query;
      const offset = (page - 1) * limit;
      
      console.log('=== 管理员获取订单列表 ===');
      console.log('请求参数:', { page, limit, search, status, service_type });
      console.log('计算偏移量:', offset);

      // 构建查询条件
      const where = {};

      if (search && search.trim() !== '') {
        where.order_no = { [Op.like]: `%${search}%` };
      }

      if (status && status.trim() !== '') {
        where.status = status;
      }

      if (service_type && service_type.trim() !== '') {
        where.service_type_id = service_type;
      }
      
      console.log('构建的查询条件:', where);

      // 使用Sequelize查询工单列表
      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        attributes: ['id', 'order_no', 'user_id', 'electrician_id', 'service_type_id', 'status', 
                    'final_amount', 'title', 'service_address', 'created_at', 'updated_at'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['nickname'],
            required: false
          },
          {
            model: User,
            as: 'electrician',
            attributes: ['nickname'],
            required: false
          },
          {
            model: ServiceType,
            as: 'serviceType', // ✅ 必须与模型定义保持一致
            attributes: ['name'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
      console.log('查询结果统计:', { total: count, returned: orders.length });

      // 格式化结果
      const enrichedOrders = orders.map(order => {
        const plainOrder = order.get({ plain: true });
        return {
          ...plainOrder,
          user_nickname: plainOrder.user ? plainOrder.user.nickname : '',
          electrician_nickname: plainOrder.electrician ? plainOrder.electrician.nickname : '',
          service_type_name: plainOrder.serviceType ? plainOrder.serviceType.name : ''
        };
      });

      res.success({
        orders: enrichedOrders,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      console.log('成功返回订单列表，数量:', enrichedOrders.length);
    } catch (error) {
      console.error('获取工单列表错误:', error);
      res.error('获取工单列表失败');
    }
  }

  // 获取工单详情
  static async getOrderDetail(req, res) {
    try {
      const { id } = req.params;

      const order = await Order.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['nickname', 'phone']
          },
          {
            model: User,
            as: 'electrician',
            attributes: ['nickname', 'phone']
          },
          {
            model: ServiceType,
            as: 'serviceType',
            attributes: ['name']
          },
          {
            model: Review,
            as: 'review'
          }
        ]
      });

      if (!order) {
        return res.error('工单不存在', 404);
      }

      // 格式化结果
      const plainOrder = order.get({ plain: true });
      const result = {
        ...plainOrder,
        user_nickname: plainOrder.user ? plainOrder.user.nickname : '',
        user_phone: plainOrder.user ? plainOrder.user.phone : '',
        electrician_nickname: plainOrder.electrician ? plainOrder.electrician.nickname : '',
        electrician_phone: plainOrder.electrician ? plainOrder.electrician.phone : '',
        service_type_name: plainOrder.serviceType ? plainOrder.serviceType.name : ''
      };
      
      // 删除嵌套对象
      delete result.user;
      delete result.electrician;
      delete result.serviceType;

      res.success(result);
    } catch (error) {
      console.error('获取工单详情错误:', error);
      res.error('获取工单详情失败');
    }
  }

  // 更新工单状态
  static async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, reason = '' } = req.body;

      const order = await Order.findByPk(id);
      if (!order) {
        return res.error('工单不存在', 404);
      }
      
      order.status = status;
      order.admin_note = reason;
      await order.save();

      res.success(null, '工单状态更新成功');
    } catch (error) {
      console.error('更新工单状态错误:', error);
      res.error('更新失败');
    }
  }

  // 获取统计数据
  static async getStatistics(req, res) {
    try {
      // 用户统计
      const totalUsers = await User.count();
      const activeUsers = await User.count({
        where: { status: 'active' }
      });
      const electricians = await User.count({
        where: { current_role: 'electrician' }
      });

      const userStats = {
        total_users: totalUsers,
        active_users: activeUsers,
        electricians: electricians
      };

      // 工单统计
      const totalOrders = await Order.count();
      const pendingOrders = await Order.count({
        where: { status: 'pending' }
      });
      const completedOrders = await Order.count({
        where: { status: 'completed' }
      });

      // 获取今天的日期（YYYY-MM-DD 格式）
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayOrders = await Order.count({
        where: {
          created_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        }
      });

      const orderStats = {
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        completed_orders: completedOrders,
        today_orders: todayOrders
      };

      // 收入统计
      const totalRevenue = await Order.sum('final_amount', {
        where: { status: 'completed' }
      }) || 0;

      const todayRevenue = await Order.sum('final_amount', {
        where: {
          status: 'completed',
          created_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        }
      }) || 0;

      // 获取本周的开始和结束日期
      const currentDate = new Date();
      const firstDayOfWeek = new Date(currentDate);
      firstDayOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      firstDayOfWeek.setHours(0, 0, 0, 0);

      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 7);

      const weekRevenue = await Order.sum('final_amount', {
        where: {
          status: 'completed',
          created_at: {
            [Op.gte]: firstDayOfWeek,
            [Op.lt]: lastDayOfWeek
          }
        }
      }) || 0;

      const revenueStats = {
        total_revenue: totalRevenue,
        today_revenue: todayRevenue,
        week_revenue: weekRevenue
      };

      res.success({
        users: userStats,
        orders: orderStats,
        revenue: revenueStats
      });
    } catch (error) {
      console.error('获取统计数据错误:', error);
      res.error('获取统计数据失败');
    }
  }

  // 获取系统通知列表
  static async getMessages(req, res) {
    try {
      const { page = 1, limit = 20, type = '', status = '' } = req.query;
      const offset = (page - 1) * limit;
      
      // 构建查询条件
      const where = {};
      
      if (type && type.trim() !== '') {
        where.type = type;
      }
      
      if (status && status.trim() !== '') {
        where.status = status;
      }
      
      // 使用 Sequelize 查询系统通知列表
      const { count, rows: messages } = await SystemMessage.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
      res.success({
        messages,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('获取系统通知错误:', error);
      res.error('获取系统通知失败');
    }
  }

  // 发布系统通知
  static async createMessage(req, res) {
    try {
      const { title, content, target_users, type, priority, scheduled_at } = req.body;
      const adminId = req.user.id;

      // 处理scheduled_at空值，将空字符串转换为NULL
      const processedScheduledAt = scheduled_at && scheduled_at.trim() !== '' ? scheduled_at : null;

      // 使用 Sequelize 创建系统通知
      const message = await SystemMessage.create({
        title,
        content,
        target_users,
        type,
        priority,
        scheduled_at: processedScheduledAt,
        created_by: adminId,
        published_at: new Date()
      });

      res.success({ id: message.id }, '通知发布成功');
    } catch (error) {
      console.error('发布系统通知错误:', error);
      res.error('发布失败');
    }
  }

  // 获取通知详情
  static async getMessageDetail(req, res) {
    try {
      const { id } = req.params;

      const message = await SystemMessage.findByPk(id);

      if (!message) {
        return res.error('通知不存在', 404);
      }

      res.success(message);
    } catch (error) {
      console.error('获取通知详情错误:', error);
      res.error('获取通知详情失败');
    }
  }

  // 更新通知
  static async updateMessage(req, res) {
    try {
      const { id } = req.params;
      const { title, content, target_users, type, priority, status } = req.body;

      const message = await SystemMessage.findByPk(id);
      
      if (!message) {
        return res.error('通知不存在', 404);
      }
      
      // 更新通知信息
      await message.update({
        title,
        content,
        target_users,
        type,
        priority,
        status,
        updated_at: new Date()
      });

      res.success(null, '通知更新成功');
    } catch (error) {
      console.error('更新通知错误:', error);
      res.error('更新失败');
    }
  }

  // 删除通知
  static async deleteMessage(req, res) {
    try {
      const { id } = req.params;
      
      const message = await SystemMessage.findByPk(id);
      
      if (!message) {
        return res.error('通知不存在', 404);
      }
      
      await message.destroy();

      res.success(null, '通知删除成功');
    } catch (error) {
      console.error('删除通知错误:', error);
      res.error('删除失败');
    }
  }
}

module.exports = AdminController;
