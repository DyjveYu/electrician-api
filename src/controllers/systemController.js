/**
 * 系统控制器
 * 处理服务类型、系统配置等功能
 */

const ServiceType = require('../models/ServiceType');
const db = require('../../config/database');

class SystemController {
  /**
   * 获取服务类型列表
   */
  static async getServiceTypes(req, res, next) {
    try {
      const serviceTypes = await ServiceType.getAll();
      res.success({
        service_types: serviceTypes
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取服务类型详情
   */
  static async getServiceTypeDetail(req, res, next) {
    try {
      const { id } = req.params;
      
      const serviceType = await ServiceType.findById(id);
      if (!serviceType) {
        return res.error('服务类型不存在', 404);
      }

      res.success({
        service_type: serviceType
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取服务类型统计
   */
  static async getServiceTypeStats(req, res, next) {
    try {
      const stats = await ServiceType.getStats();
      res.success({
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取系统配置
   */
  static async getSystemConfig(req, res, next) {
    try {
      const { keys } = req.query;
      
      let whereClause = '';
      let params = [];
      
      if (keys) {
        const keyArray = keys.split(',');
        whereClause = `WHERE config_key IN (${keyArray.map(() => '?').join(',')})`;
        params = keyArray;
      }
      
      const [rows] = await db.query(
        `SELECT config_key, config_value, description FROM system_configs ${whereClause}`,
        params
      );
      
      // 转换为对象格式
      const config = {};
      rows.forEach(row => {
        config[row.config_key] = {
          value: row.config_value,
          description: row.description
        };
      });
      
      res.success({ config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取应用信息
   */
  static async getAppInfo(req, res, next) {
    try {
      // 获取基本配置
      const [configRows] = await db.query(
        `SELECT config_key, config_value FROM system_configs 
         WHERE config_key IN ('platform_name', 'contact_phone', 'privacy_policy_url')`
      );
      
      const config = {};
      configRows.forEach(row => {
        config[row.config_key] = row.config_value;
      });
      
      // 获取服务类型
      const serviceTypes = await ServiceType.getAll();
      
      // 获取统计信息
      const [statsRows] = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
          (SELECT COUNT(*) FROM users WHERE current_role = 'electrician' AND status = 'active') as total_electricians,
          (SELECT COUNT(*) FROM orders) as total_orders,
          (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders
        `
      );
      
      const stats = statsRows[0];
      
      res.success({
        app_info: {
          platform_name: config.platform_name || '电工维修平台',
          contact_phone: config.contact_phone || '400-123-4567',
          privacy_policy_url: config.privacy_policy_url || '',
          version: '1.0.0',
          service_types: serviceTypes,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 上传文件
   */
  static async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.error('请选择要上传的文件', 400);
      }

      const file = req.file;
      const fileUrl = `/uploads/${file.filename}`;
      
      // 这里可以添加文件信息到数据库的逻辑
      
      res.success({
        message: '文件上传成功',
        file_url: fileUrl,
        file_info: {
          original_name: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取附近的电工（基于地理位置）
   */
  static async getNearbyElectricians(req, res, next) {
    try {
      const { latitude, longitude, distance = 1000 } = req.query;
      
      if (!latitude || !longitude) {
        return res.error('请提供位置坐标', 400);
      }
      
      // 查询附近的电工（这里简化处理，实际应该基于电工的位置信息）
      const [rows] = await db.query(
        `SELECT 
          u.id, u.nickname, u.avatar, u.phone,
          ec.certificate_number, ec.experience_years,
          (
            SELECT AVG(rating) FROM reviews r 
            JOIN orders wo ON r.order_id = wo.id 
            WHERE wo.electrician_id = u.id
          ) as avg_rating,
          (
            SELECT COUNT(*) FROM orders wo 
            WHERE wo.electrician_id = u.id AND wo.status = 'completed'
          ) as completed_orders
         FROM users u
         JOIN electrician_certifications ec ON u.id = ec.user_id
         WHERE u.current_role = 'electrician' 
         AND u.status = 'active'
         AND ec.status = 'approved'
         ORDER BY completed_orders DESC, avg_rating DESC
         LIMIT 20`,
        []
      );
      
      res.success({
        electricians: rows
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 搜索功能
   */
  static async search(req, res, next) {
    try {
      const { keyword, type = 'all' } = req.query;
      
      if (!keyword || keyword.trim().length < 2) {
        return res.error('搜索关键词至少2个字符', 400);
      }
      
      const results = {
        orders: [],
        electricians: [],
        service_types: []
      };
      
      const searchKeyword = `%${keyword.trim()}%`;
      
      // 搜索工单
      if (type === 'all' || type === 'orders') {
        const [orderRows] = await db.query(
          `SELECT wo.*, st.name as service_type_name, u.nickname as user_nickname
           FROM orders wo
           LEFT JOIN service_types st ON wo.service_type_id = st.id
           LEFT JOIN users u ON wo.user_id = u.id
           WHERE (wo.title LIKE ? OR wo.description LIKE ? OR wo.order_no LIKE ?)
           AND wo.status = 'pending'
           ORDER BY wo.created_at DESC
           LIMIT 10`,
          [searchKeyword, searchKeyword, searchKeyword]
        );
        results.orders = orderRows;
      }
      
      // 搜索电工
      if (type === 'all' || type === 'electricians') {
        const [electricianRows] = await db.query(
          `SELECT u.id, u.nickname, u.avatar, u.phone,
                  ec.certificate_number, ec.experience_years
           FROM users u
           JOIN electrician_certifications ec ON u.id = ec.user_id
           WHERE u.current_role = 'electrician'
           AND u.status = 'active'
           AND ec.status = 'approved'
           AND (u.nickname LIKE ? OR u.phone LIKE ?)
           ORDER BY u.created_at DESC
           LIMIT 10`,
          [searchKeyword, searchKeyword]
        );
        results.electricians = electricianRows;
      }
      
      // 搜索服务类型
      if (type === 'all' || type === 'service_types') {
        const [serviceTypeRows] = await db.query(
          `SELECT * FROM service_types
           WHERE status = 'active'
           AND (name LIKE ? OR description LIKE ?)
           ORDER BY sort_order ASC
           LIMIT 10`,
          [searchKeyword, searchKeyword]
        );
        results.service_types = serviceTypeRows;
      }
      
      res.success({
        keyword,
        results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取平台统计数据
   */
  static async getPlatformStats(req, res, next) {
    try {
      const [rows] = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
          (SELECT COUNT(*) FROM users WHERE current_role = 'user' AND status = 'active') as total_customers,
          (SELECT COUNT(*) FROM users WHERE current_role = 'electrician' AND status = 'active') as total_electricians,
          (SELECT COUNT(*) FROM orders) as total_orders,
          (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
          (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
          (SELECT COALESCE(SUM(final_amount), 0) FROM orders WHERE status = 'completed') as total_revenue,
          (SELECT COUNT(*) FROM payments WHERE status = 'paid') as total_payments
        `
      );
      
      const stats = rows[0] || {
        total_users: 0,
        total_customers: 0,
        total_electricians: 0,
        total_orders: 0,
        pending_orders: 0,
        completed_orders: 0,
        total_revenue: 0,
        total_payments: 0
      };
      
      // 计算完成率
      stats.completion_rate = stats.total_orders > 0 
        ? (stats.completed_orders / stats.total_orders * 100).toFixed(2)
        : 0;
      
      res.success({ stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SystemController;