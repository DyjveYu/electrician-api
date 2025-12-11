const {
  SystemMessage,
  UserMessageRead,
  User,
  Message,
  Order,
  Sequelize
} = require('../models');
const { Op } = Sequelize;
const AppError = require('../utils/AppError');

class MessageController {
  static buildSystemMessagePayload(messageObj, isRead) {
    return {
      ...messageObj,
      createTime: messageObj.created_at,
      is_read: isRead ? 1 : 0
    };
  }

  static buildOrderMessagePayload(messageObj) {
    const orderInfo = messageObj.order || {};
    return {
      ...messageObj,
      orderId: orderInfo.id || messageObj.related_id,
      orderNumber: orderInfo.order_no,
      orderStatus: orderInfo.status,
      createTime: messageObj.created_at,
      is_read: messageObj.is_read ? 1 : 0
    };
  }

  /**
   * 获取用户消息列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件函数
   */
  static async getMessages(req, res, next) {
    try {
      const { page = 1, limit = 20, type = '' } = req.query;
      const userId = req.user.id;
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);
      const numOffset = (numPage - 1) * numLimit;
      const normalizedType = (type || '').trim().toLowerCase();

      if (normalizedType === 'order') {
        const { count, rows } = await Message.findAndCountAll({
          where: {
            user_id: userId,
            type: 'order'
          },
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'order_no', 'status']
          }],
          order: [['created_at', 'DESC']],
          limit: numLimit,
          offset: numOffset
        });

        const messages = rows.map((message) => {
          const plain = message.toJSON();
          return MessageController.buildOrderMessagePayload(plain);
        });

        const totalPages = Math.ceil(count / numLimit);

        return res.success({
          messages,
          pagination: {
            page: numPage,
            limit: numLimit,
            total: count,
            totalPages,
            hasMore: numPage < totalPages
          }
        });
      }

      const whereConditions = {
        status: 'published',
        [Op.or]: [
          { target_users: 'all' },
          { target_users: 'users' },
          { target_users: 'electricians' }
        ],
        type: {
          [Op.in]: ['system', 'maintenance', 'activity']
        }
      };

      const { count, rows } = await SystemMessage.findAndCountAll({
        where: whereConditions,
        include: [{
          model: User,
          as: 'readUsers',
          attributes: [],
          through: {
            attributes: []
          },
          where: {
            id: userId
          },
          required: false
        }],
        order: [['created_at', 'DESC']],
        limit: numLimit,
        offset: numOffset,
        subQuery: false
      });

      const messages = await Promise.all(rows.map(async (message) => {
        const messageObj = message.toJSON();
        const readRecord = await UserMessageRead.findOne({
          where: {
            user_id: userId,
            message_id: message.id
          },
          attributes: ['id']
        });
        return MessageController.buildSystemMessagePayload(messageObj, !!readRecord);
      }));

      const totalPages = Math.ceil(count / numLimit);

      res.success({
        messages,
        pagination: {
          page: numPage,
          limit: numLimit,
          total: count,
          totalPages,
          hasMore: numPage < totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取消息详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件函数
   */
  static async getMessageDetail(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const orderMessage = await Message.findOne({
        where: {
          id,
          user_id: userId
        },
        include: [{
          model: Order,
          as: 'order',
          attributes: ['id', 'order_no', 'status']
        }]
      });

      if (orderMessage) {
        return res.success(MessageController.buildOrderMessagePayload(orderMessage.toJSON()));
      }

      const messageData = await SystemMessage.findOne({
        where: {
          id,
          status: 'published',
          [Op.or]: [
            { target_users: 'all' },
            { target_users: 'users' },
            { target_users: 'electricians' }
          ]
        },
        include: [{
          model: User,
          as: 'readUsers',
          attributes: [],
          through: {
            attributes: []
          },
          where: {
            id: userId
          },
          required: false
        }]
      });

      if (!messageData) {
        throw new AppError('消息不存在', 404);
      }

      const readRecord = await UserMessageRead.findOne({
        where: {
          user_id: userId,
          message_id: id
        },
        attributes: ['id']
      });

      res.success(MessageController.buildSystemMessagePayload(messageData.toJSON(), !!readRecord));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 标记消息为已读
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件函数
   */
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const orderMessage = await Message.findOne({
        where: {
          id,
          user_id: userId
        }
      });

      if (orderMessage) {
        if (!orderMessage.is_read) {
          orderMessage.is_read = true;
          orderMessage.read_at = new Date();
          await orderMessage.save();
        }
        return res.success({ message: '消息已标记为已读' });
      }

      const systemMessage = await SystemMessage.findOne({
        where: {
          id,
          status: 'published',
          [Op.or]: [
            { target_users: 'all' },
            { target_users: 'users' },
            { target_users: 'electricians' }
          ]
        }
      });

      if (!systemMessage) {
        throw new AppError('消息不存在', 404);
      }

      await UserMessageRead.findOrCreate({
        where: {
          user_id: userId,
          message_id: id
        },
        defaults: {
          read_at: new Date()
        }
      });

      res.success({ message: '消息已标记为已读' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取未读消息数量
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - 下一个中间件函数
   */
  static async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;

      const readMessageIds = await UserMessageRead.findAll({
        where: { user_id: userId },
        attributes: ['message_id'],
        raw: true
      }).then(reads => reads.map(read => read.message_id));

      const orderUnreadCount = await Message.count({
        where: {
          user_id: userId,
          type: 'order',
          is_read: 0
        }
      });

      const systemUnreadCount = await SystemMessage.count({
        where: {
          status: 'published',
          type: {
            [Op.in]: ['system', 'maintenance', 'activity']
          },
          [Op.or]: [
            { target_users: 'all' },
            { target_users: 'users' },
            { target_users: 'electricians' }
          ],
          ...(readMessageIds.length > 0 ? {
            id: {
              [Op.notIn]: readMessageIds
            }
          } : {})
        }
      });

      res.success({
        orderUnreadCount,
        systemUnreadCount,
        totalUnreadCount: orderUnreadCount + systemUnreadCount
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MessageController;