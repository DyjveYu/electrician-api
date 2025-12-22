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
    console.log('========== 开始处理电工认证提交 ==========');
    console.log('1. 请求到达控制器');
    console.log('2. 用户ID:', req.user?.id);
    console.log('3. 请求体:', JSON.stringify(req.body, null, 2));
    
    try {
      const userId = req.user.id;
      const {
        work_types,
        real_name,
        id_card,
        electrician_cert_no,
        cert_start_date,
        cert_end_date
      } = req.body;

      console.log('4. 开始查询现有认证记录...');
      
      // 检查现有记录
      const existing = await ElectricianCertification.findOne({
        where: { user_id: userId }
      });

      console.log('5. 现有认证记录:', existing ? `存在，ID=${existing.id}` : '不存在');

      let certification;

      if (existing) {
        console.log('6. 更新现有认证记录...');
        // 更新
        await existing.update({
          work_types,
          real_name,
          id_card,
          electrician_cert_no,
          cert_start_date,
          cert_end_date,
          status: 'pending',
          reject_reason: null
        });
        certification = existing;
        console.log('7. 更新成功');
      } else {
        console.log('6. 创建新认证记录...');
        // 创建
        certification = await ElectricianCertification.create({
          user_id: userId,
          work_types,
          real_name,
          id_card,
          electrician_cert_no,
          cert_start_date,
          cert_end_date,
          status: 'pending'
        });
        console.log('7. 创建成功，新ID:', certification.id);
      }

      console.log('8. 尝试缓存到Redis（设置3秒超时）...');
      // 缓存认证状态（可选，Redis连接失败不影响主流程）
      // 使用 Promise.race 设置超时，避免阻塞
      try {
        await Promise.race([
          redisOperations.set(
            `electrician:certification:${userId}`, 
            JSON.stringify({
              id: certification.id,
              status: certification.status,
              updated_at: new Date()
            }),
            3600
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), 3000)
          )
        ]);
        console.log('9. Redis缓存成功 ✅');
      } catch (redisError) {
        console.warn('9. Redis缓存失败（不影响主流程）⚠️:', redisError.message);
        // 不抛出错误，继续执行
      }

      console.log('10. 准备返回成功响应...');
      console.log('11. 认证ID:', certification.id, '状态:', certification.status);
      
      const responseData = {
        certification: {
          id: certification.id,
          status: certification.status
        }
      };
      
      console.log('12. 响应数据:', JSON.stringify(responseData, null, 2));
      
      res.success(responseData, '认证申请提交成功，等待审核');
      
      console.log('13. 响应已发送 ✅');
      console.log('========== 电工认证提交处理完成 ==========\n');

    } catch (error) {
      console.error('❌ 控制器处理出错:', error);
      console.error('错误堆栈:', error.stack);
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