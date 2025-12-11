/**
 * 工单模型 - 已弃用
 * 此模型已不再使用，项目现在使用 Order.js 模型代替
 * TODO: 项目上线后可以删除此文件
 */

const db = require('../../config/database');

class WorkOrder {
  /**
   * 创建工单
   */
  static async create(orderData) {
    const {
      user_id,
      service_type_id,
      title,
      description,
      images = '[]',
      contact_name,
      contact_phone,
      address,
      latitude,
      longitude,
      expected_time,
      budget_min,
      budget_max
    } = orderData;

    // 生成工单号
    const order_no = this.generateOrderNo();

    const [result] = await db.query(
      `INSERT INTO work_orders (
        order_no, user_id, service_type_id, title, description, images,
        contact_name, contact_phone, address, latitude, longitude,
        expected_time, budget_min, budget_max, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        order_no, user_id, service_type_id, title, description, images,
        contact_name, contact_phone, address, latitude, longitude,
        expected_time, budget_min, budget_max
      ]
    );

    return {
      id: result.insertId,
      order_no,
      ...orderData,
      status: 'pending'
    };
  }

  /**
   * 根据ID查找工单
   */
  static async findById(id) {
    const [rows] = await db.query(
      `SELECT wo.*, st.name as service_type_name, 
              u.nickname as user_nickname, u.phone as user_phone,
              e.nickname as electrician_nickname, e.phone as electrician_phone
       FROM work_orders wo
       LEFT JOIN service_types st ON wo.service_type_id = st.id
       LEFT JOIN users u ON wo.user_id = u.id
       LEFT JOIN users e ON wo.electrician_id = e.id
       WHERE wo.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * 根据工单号查找工单
   */
  static async findByOrderNo(orderNo) {
    const [rows] = await db.query(
      `SELECT wo.*, st.name as service_type_name,
              u.nickname as user_nickname, u.phone as user_phone,
              e.nickname as electrician_nickname, e.phone as electrician_phone
       FROM work_orders wo
       LEFT JOIN service_types st ON wo.service_type_id = st.id
       LEFT JOIN users u ON wo.user_id = u.id
       LEFT JOIN users e ON wo.electrician_id = e.id
       WHERE wo.order_no = ?`,
      [orderNo]
    );
    return rows[0] || null;
  }

  /**
   * 获取工单列表
   */
  static async getList(options = {}) {
    const {
      page = 1,
      limit = 20,
      user_id,
      electrician_id,
      status,
      service_type_id,
      search,
      latitude,
      longitude,
      distance = 1000, // 默认1000米范围
      sort = 'created_at',
      order = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let selectFields = 'wo.*, st.name as service_type_name, u.nickname as user_nickname';
    let joinClause = `
      LEFT JOIN service_types st ON wo.service_type_id = st.id
      LEFT JOIN users u ON wo.user_id = u.id
    `;

    // 如果提供了坐标，计算距离
    if (latitude && longitude) {
      selectFields += `, (
        6371 * acos(
          cos(radians(?)) * cos(radians(wo.latitude)) *
          cos(radians(wo.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(wo.latitude))
        )
      ) * 1000 as distance`;
      params.unshift(latitude, longitude, latitude);
      
      // 添加距离过滤
      whereConditions.push(`(
        6371 * acos(
          cos(radians(?)) * cos(radians(wo.latitude)) *
          cos(radians(wo.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(wo.latitude))
        )
      ) * 1000 <= ?`);
      params.push(latitude, longitude, latitude, distance);
    }

    // 用户ID过滤
    if (user_id) {
      whereConditions.push('wo.user_id = ?');
      params.push(user_id);
    }

    // 电工ID过滤
    if (electrician_id) {
      whereConditions.push('wo.electrician_id = ?');
      params.push(electrician_id);
    }

    // 状态过滤
    if (status) {
      if (Array.isArray(status)) {
        whereConditions.push(`wo.status IN (${status.map(() => '?').join(',')})`);
        params.push(...status);
      } else {
        whereConditions.push('wo.status = ?');
        params.push(status);
      }
    }

    // 服务类型过滤
    if (service_type_id) {
      whereConditions.push('wo.service_type_id = ?');
      params.push(service_type_id);
    }

    // 搜索过滤
    if (search) {
      whereConditions.push('(wo.title LIKE ? OR wo.description LIKE ? OR wo.order_no LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM work_orders wo 
      ${joinClause}
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    // 获取列表
    const listQuery = `
      SELECT ${selectFields}
      FROM work_orders wo
      ${joinClause}
      ${whereClause}
      ORDER BY wo.${sort} ${order}
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(listQuery, [...params, limit, offset]);

    return {
      list: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 更新工单状态
   */
  static async updateStatus(id, status, updateData = {}) {
    const fields = ['status = ?', 'updated_at = NOW()'];
    const values = [status];

    // 添加其他更新字段
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    values.push(id);

    const [result] = await db.query(
      `UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * 电工抢单
   */
  static async takeOrder(orderId, electricianId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // 检查工单状态
      const [orderRows] = await connection.query(
        'SELECT * FROM work_orders WHERE id = ? FOR UPDATE',
        [orderId]
      );

      if (!orderRows[0]) {
        throw new Error('工单不存在');
      }

      const order = orderRows[0];
      if (order.status !== 'pending') {
        throw new Error('工单状态不允许抢单');
      }

      if (order.electrician_id) {
        throw new Error('工单已被其他电工接取');
      }

      // 更新工单状态
      await connection.query(
        `UPDATE work_orders SET 
         electrician_id = ?, status = 'accepted', 
         accepted_at = NOW(), updated_at = NOW() 
         WHERE id = ?`,
        [electricianId, orderId]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 用户确认工单
   */
  static async confirmOrder(orderId, userId) {
    // 检查工单归属
    const order = await this.findById(orderId);
    if (!order || order.user_id !== userId) {
      throw new Error('工单不存在或无权限操作');
    }

    if (order.status !== 'accepted') {
      throw new Error('工单状态不允许确认');
    }

    const success = await this.updateStatus(orderId, 'in_progress', {
      confirmed_at: new Date()
    });

    return success;
  }

  /**
   * 开始服务
   */
  static async startService(orderId, electricianId) {
    // 检查工单归属
    const order = await this.findById(orderId);
    if (!order || order.electrician_id !== electricianId) {
      throw new Error('工单不存在或无权限操作');
    }

    if (order.status !== 'in_progress') {
      throw new Error('工单状态不允许开始服务');
    }

    const success = await this.updateStatus(orderId, 'in_progress', {
      started_at: new Date()
    });

    return success;
  }

  /**
   * 完成服务
   */
  static async completeService(orderId, electricianId, completionData = {}) {
    // 检查工单归属
    const order = await this.findById(orderId);
    if (!order || order.electrician_id !== electricianId) {
      throw new Error('工单不存在或无权限操作');
    }

    if (order.status !== 'in_progress') {
      throw new Error('工单状态不允许完成服务');
    }

    const updateData = {
      completed_at: new Date(),
      ...completionData
    };

    const success = await this.updateStatus(orderId, 'completed', updateData);
    return success;
  }

  /**
   * 取消工单
   */
  static async cancelOrder(orderId, userId, reason = '') {
    // 检查工单归属
    const order = await this.findById(orderId);
    if (!order || order.user_id !== userId) {
      throw new Error('工单不存在或无权限操作');
    }

    // 只有pending和accepted状态可以取消
    if (!['pending', 'accepted'].includes(order.status)) {
      throw new Error('当前状态不允许取消工单');
    }

    const success = await this.updateStatus(orderId, 'cancelled', {
      cancelled_at: new Date(),
      cancel_reason: reason
    });

    return success;
  }

  /**
   * 生成工单号
   */
  static generateOrderNo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `WO${year}${month}${day}${timestamp}${random}`;
  }

  /**
   * 获取工单统计信息
   */
  static async getStats(options = {}) {
    const { user_id, electrician_id, date_range } = options;
    
    let whereConditions = [];
    let params = [];

    if (user_id) {
      whereConditions.push('user_id = ?');
      params.push(user_id);
    }

    if (electrician_id) {
      whereConditions.push('electrician_id = ?');
      params.push(electrician_id);
    }

    if (date_range && date_range.start && date_range.end) {
      whereConditions.push('created_at BETWEEN ? AND ?');
      params.push(date_range.start, date_range.end);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const [rows] = await db.query(
      `SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_orders,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
       FROM work_orders ${whereClause}`,
      params
    );

    return rows[0];
  }
}

module.exports = WorkOrder;