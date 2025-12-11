/**
 * 电工认证控制器
 * 处理电工认证申请和状态查询
 */

const { ElectricianCertification, User } = require('../models');
const AppError = require('../utils/AppError');
const { redisOperations } = require('../config/redis');

class ElectricianController {
  /**
   * 提交电工认证
   * @route POST /api/electricians/certification
   * @access Private
   */
  static async submitCertification(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        real_name,
        id_card,
        electrician_cert_no,
        cert_start_date,
        cert_end_date
      } = req.body;

      // 检查现有记录
      const existing = await ElectricianCertification.findOne({
        where: { user_id: userId }
      });

      let certification;

      if (existing) {
        // 更新
        await existing.update({
          real_name,
          id_card,
          electrician_cert_no,
          cert_start_date,
          cert_end_date,
          status: 'pending',
          reject_reason: null
        });
        certification = existing;
      } else {
        // 创建
        certification = await ElectricianCertification.create({
          user_id: userId,
          real_name,
          id_card,
          electrician_cert_no,
          cert_start_date,
          cert_end_date,
          status: 'pending'
        });
      }

      // 缓存认证状态（可选）
      try {
        await redisOperations.set(
          `electrician:certification:${userId}`, 
          JSON.stringify({
            id: certification.id,
            status: certification.status,
            updated_at: new Date()
          }),
          3600
        );
      } catch (redisError) {
        console.warn('Redis缓存认证状态失败:', redisError.message);
      }

      res.success({
        certification: {
          id: certification.id,
          status: certification.status
        }
      }, '认证申请提交成功，等待审核');

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取认证状态
   * @route GET /api/electricians/certification/status
   * @access Private
   */
  static async getCertificationStatus(req, res, next) {
    try {
      const userId = req.user.id;

      // 尝试从缓存获取（可选）
      let cachedData;
      try {
        cachedData = await redisOperations.get(`electrician:certification:${userId}`);
        if (cachedData) {
          cachedData = JSON.parse(cachedData);
        }
      } catch (redisError) {
        console.warn('Redis获取认证状态缓存失败:', redisError.message);
      }

      // 如果缓存中有最新数据且不是pending状态，直接返回
      if (cachedData && cachedData.status !== 'pending') {
        const messages = {
          approved: '认证已通过',
          rejected: '认证被拒绝'
        };

        return res.success({
          status: cachedData.status,
          message: messages[cachedData.status],
          certification: cachedData
        });
      }

      // 从数据库获取
      const cert = await ElectricianCertification.findOne({
        where: { user_id: userId }
      });

      if (!cert) {
        return res.success({
          status: 'not_submitted',
          message: '未提交认证',
          certification: null
        });
      }

      const messages = {
        pending: '认证审核中',
        approved: '认证已通过',
        rejected: `认证被拒绝：${cert.reject_reason || '无原因'}`
      };

      // 如果状态已变更，更新用户角色权限
      if (cert.status === 'approved') {
        try {
          const user = await User.findByPk(userId);
          if (user && !user.can_be_electrician) {
            await user.update({ can_be_electrician: true });
          }
        } catch (userError) {
          console.error('更新用户电工权限失败:', userError);
        }
      }

      res.success({
        status: cert.status,
        message: messages[cert.status],
        certification: cert
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = ElectricianController;