/**
 * 用户认证控制器
 * 处理用户登录、注册、角色切换等功能
 */

//const User = require('../models/User'); 老的导入方式
const { User, ElectricianCertification, Order } = require('../models');
const AppError = require('../utils/AppError');
const SmsService = require('../utils/smsService');
const { redisOperations } = require('../config/redis');
const axios = require('axios');

class AuthController {
  /**
   * 微信小程序 code2session
   * 用 code 换取 openid 和 session_key
   */
  static async code2Session(req, res, next) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.error('Code不能为空', 400);
      }

      const appId = process.env.WECHAT_APP_ID;
      const appSecret = process.env.WECHAT_APP_SECRET;

      if (!appId || !appSecret) {
        console.error('未配置小程序 AppID 或 Secret');
        return res.error('服务器配置错误', 500);
      }

      // 调用微信接口
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

      const response = await axios.get(url);
      const { errcode, errmsg, openid, session_key } = response.data;

      if (errcode && errcode !== 0) {
        console.error('微信 code2session 失败:', response.data);
        return res.error(`获取OpenID失败: ${errmsg}`, 400);
      }

      // 返回 openid 给前端
      res.success({
        openid
      });

    } catch (error) {
      console.error('code2Session 接口异常:', error);
      next(error);
    }
  }

  /**
   * 发送验证码
   */
  static async sendCode(req, res, next) {
    try {
      const { phone, type = 'login' } = req.body;

      // 验证手机号格式
      if (!SmsService.validatePhone(phone)) {
        throw new AppError('手机号格式不正确', 400);
      }

      // 验证类型
      const validTypes = ['login', 'register', 'reset_password'];
      if (!validTypes.includes(type)) {
        throw new AppError('验证码类型不正确', 400);
      }

      const result = await SmsService.sendVerificationCode(phone, type);

      if (result.success) {
        const response = {
          message: result.message
        };

        // 测试环境返回验证码
        if (process.env.NODE_ENV !== 'production' && result.code) {
          response.code = result.code;
        }

        res.success(response);
      } else {
        res.error(result.message, 400);
      }
    } catch (error) {
      console.error('authController 出错:', error);
      next(error);
    }
  }

  /**
   * 用户登录/注册
   */
  static async login(req, res, next) {
    try {
      const { phone, code, initialRole, openid } = req.body;

      // 调试日志：查看接收到的参数
      console.log('登录接口接收到的参数:', { phone, code, initialRole, openid });

      // 验证手机号格式
      if (!SmsService.validatePhone(phone)) {
        throw new AppError('手机号格式不正确', 400);
      }

      // 验证验证码
      const testAccounts = ['13800138040', '13800138041'];
      if (!testAccounts.includes(phone)) {
        const codeResult = await SmsService.verifyCode(phone, code, 'login');
        if (!codeResult.success) {
          throw new AppError(codeResult.message, 400);
        }
      } else {
        console.log(`测试账号 ${phone} 登录，跳过验证码校验`);
      }

      // 查找或创建用户
      let user = await User.findByPhone(phone);

      if (!user) {
        // 新用户注册：根据前端传递的 initialRole 设置角色
        // 只有当 openid 是有效非空字符串时才保存
        const userData = { phone };
        if (openid && openid !== '') {
            userData.openid = openid;
        }
        
        if (initialRole === 'electrician') {
          userData.current_role = 'electrician';
        }
        console.log('创建新用户，userData:', userData);
        user = await User.createUser(userData);
        console.log('新创建的用户信息:', { id: user.id, phone: user.phone, current_role: user.current_role });
      } else {
        console.log('老用户登录，忽略 initialRole:', { id: user.id, phone: user.phone, current_role: user.current_role });
        
        // 如果是老用户，更新 openid (如果传了的话)
        // 注意：空字符串 '' 也会被视为有值传入，需要特殊处理
        if (openid !== undefined && openid !== null) {
          if (openid === '') {
             // 如果传入空字符串，不做任何操作，或者根据业务需求决定是否清除
             console.log(`[Auth Debug] Empty OpenID provided for User ${user.id}, skipping update`);
          } else if (user.openid !== openid) {
             await user.update({ openid });
             console.log(`[Auth Debug] Updated User ${user.id} OpenID to: ${openid}`);
          } else {
             console.log(`[Auth Debug] User ${user.id} already has correct OpenID: ${openid}`);
          }
        } else {
            console.log(`[Auth Debug] No OpenID provided for User ${user.id}`);
        }
      }

      // 检查用户状态
      if (user.status === 'banned') {
        throw new AppError('账号已被禁用，请联系客服', 403);
      }

      // 更新最后登录时间
      await User.updateLastLogin(user.id);

      // 生成token
      const token = User.generateToken(user);

      // 获取用户统计信息
      const stats = await User.getUserStats(user.id, user.current_role);

      // 获取电工认证信息（如果是电工角色）
      let certification = null;
      if (user.current_role === 'electrician') {
        certification = await User.getElectricianCertification(user.id);
      }

      res.success({
        token,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          current_role: user.current_role,
          status: user.status,
          created_at: user.created_at
        },
        stats,
        certification
      });
    } catch (error) {
      console.error('authController 出错:', error);

      // 如果是业务错误，可带上自定义信息
      if (error.isJoi) {
        return next({
          status: 422,
          message: error.details[0].message
        });
      }

      if (error.code === 'ER_DUP_ENTRY') {
        return next({
          status: 409,
          message: '账号已存在'
        });
      }

      // 其他错误交给全局中间件
      next(error);
    }
  }

  /**
   * 获取用户信息
   */
  static async getUserInfo(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.error('用户不存在', 404);
      }

      // 获取用户统计信息
      const stats = await User.getUserStats(userId, user.current_role);

      // 不论当前角色，都尝试查询认证信息 update by dyjveyu 25.10.30
      const certification = await User.getElectricianCertification(userId);

      let certificationStatus = 'unverified';
      let isElectrician = false;

      if (certification) {
        certificationStatus = certification.status; // pending / approved / rejected
        if (certification.status === 'approved') {
          isElectrician = true;
        }
      }
      res.success({
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          current_role: user.current_role,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login_at: user.last_login_at,
          certificationStatus,
          isElectrician
        },
        stats,
        certification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新用户信息
   */
  static async updateProfile(req, res, next) {
    console.log('接收到的 req.body:', req.body);
    try {
      const userId = req.user.id;
      const { nickname, avatar } = req.body;

      const updateData = {};
      if (nickname !== undefined) updateData.nickname = nickname;
      if (avatar !== undefined) updateData.avatar = avatar;

      if (Object.keys(updateData).length === 0) {
        return res.error('没有要更新的信息', 400);
      }

      const result = await User.update(userId, updateData);

      if (result.success) {
        res.success({ message: result.message || '用户信息更新成功' });
      } else {
        res.error(result.message || '用户信息更新失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 切换用户角色
   */
  static async switchRole(req, res, next) {
    try {
      const userId = req.user.id;
      const { role } = req.body;

      // 验证角色
      const validRoles = ['user', 'electrician'];
      if (!validRoles.includes(role)) {
        return res.error('无效的角色类型', 400);
      }

      // 如果切换到电工角色，需要检查认证状态
      if (role === 'electrician') {
        const canSwitch = await User.canSwitchToElectrician(userId);
        if (!canSwitch) {
          return res.error('您还未通过电工认证，无法切换到电工角色', 403);
        }
      }

      const success = await User.switchRole(userId, role);

      if (success) {
        // 生成新的token（包含新角色信息）
        const user = await User.findById(userId);
        const token = User.generateToken(user);

        // 获取新角色的统计信息
        const stats = await User.getUserStats(userId, role);

        res.success({
          message: '角色切换成功',
          token,
          current_role: role,
          stats
        });
      } else {
        res.error('角色切换失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 刷新token
   */
  static async refreshToken(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.error('用户不存在', 404);
      }

      if (user.status === 'banned') {
        return res.error('账号已被禁用', 403);
      }

      // 生成新token
      const token = User.generateToken(user);

      res.success({
        token,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户登出
   */
  static async logout(req, res, next) {
    try {
      // 可以在这里实现token黑名单机制
      // 将当前token加入黑名单，防止继续使用

      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        // 将token加入Redis黑名单
        const decoded = User.verifyToken(token);
        const expireTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (expireTime > 0) {
          // 使用封装的 Redis 方法
          await redisOperations.set(`blacklist:${token}`, '1', expireTime);
        }
      }

      res.success({ message: '登出成功' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证token是否有效
   */
  static async verifyToken(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.error('用户不存在', 404);
      }

      if (user.status === 'banned') {
        return res.error('账号已被禁用', 403);
      }

      res.success({
        valid: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          current_role: user.current_role,
          status: user.status
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;