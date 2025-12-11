/**
 * 短信服务工具类
 * 处理短信验证码发送和验证
 */

// 内存存储（开发环境使用）
const memoryStore = new Map();

class SmsService {
  /**
   * 发送验证码
   */
  static async sendVerificationCode(phone, type = 'login') {
    try {
      // 检查发送频率限制（60秒内只能发送一次）
      const lastSendKey = `sms:last_send:${phone}`;
      const lastSendData = memoryStore.get(lastSendKey);
      
      if (lastSendData && lastSendData.expiry > Date.now()) {
        const timeDiff = Date.now() - lastSendData.timestamp;
        if (timeDiff < 60000) { // 60秒
          const remainingTime = Math.ceil((60000 - timeDiff) / 1000);
          throw new Error(`请等待${remainingTime}秒后再试`);
        }
      }

      // 生成6位验证码
      const code = this.generateCode();
      console.log('Current NODE_ENV:', process.env.NODE_ENV);
      // 在测试环境使用固定验证码
      const isTestEnv = process.env.NODE_ENV !== 'production';
      const finalCode = isTestEnv ? '123456' : code;
      
      // 存储验证码到内存（5分钟有效期）
      const codeKey = `sms:code:${phone}:${type}`;
      memoryStore.set(codeKey, {
        code: finalCode,
        expiry: Date.now() + 300000 // 5分钟过期
      });
      
      // 记录发送时间
      memoryStore.set(lastSendKey, {
        timestamp: Date.now(),
        expiry: Date.now() + 60000 // 1分钟过期
      });
      
      if (isTestEnv) {
        console.log(`📱 测试环境短信验证码: ${phone} -> ${finalCode}`);
        return {
          success: true,
          message: '验证码发送成功（测试环境）',
          code: finalCode // 测试环境返回验证码
        };
      }
      
      // 生产环境调用真实短信服务
      const smsResult = await this.sendSms(phone, finalCode, type);
      
      if (smsResult.success) {
        return {
          success: true,
          message: '验证码发送成功'
        };
      } else {
        throw new Error(smsResult.message || '短信发送失败');
      }
      
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw error;
    }
  }

  /**
   * 验证验证码
   */
  static async verifyCode(phone, code, type = 'login') {
    try {
      const codeKey = `sms:code:${phone}:${type}`;
      const storedData = memoryStore.get(codeKey);
      
      if (!storedData || storedData.expiry < Date.now()) {
        return {
          success: false,
          message: '验证码已过期或不存在'
        };
      }
      
      if (storedData.code !== code) {
        return {
          success: false,
          message: '验证码错误'
        };
      }
      
      // 验证成功后删除验证码
      memoryStore.delete(codeKey);
      
      return {
        success: true,
        message: '验证码验证成功'
      };
      
    } catch (error) {
      console.error('验证码验证失败:', error);
      return {
        success: false,
        message: '验证码验证失败'
      };
    }
  }

  /**
   * 生成6位数字验证码
   */
  static generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 发送短信（生产环境）
   * 这里需要根据实际使用的短信服务商进行实现
   */
  static async sendSms(phone, code, type) {
    try {
      // 这里应该调用实际的短信服务API
      // 例如：阿里云短信、腾讯云短信等
      
      const templates = {
        login: `您的登录验证码是：${code}，5分钟内有效，请勿泄露。`,
        register: `您的注册验证码是：${code}，5分钟内有效，请勿泄露。`,
        reset_password: `您的密码重置验证码是：${code}，5分钟内有效，请勿泄露。`
      };
      
      const message = templates[type] || templates.login;
      
      // 示例：使用阿里云短信服务
      // const result = await aliSmsClient.sendSms({
      //   PhoneNumbers: phone,
      //   SignName: '电工维修平台',
      //   TemplateCode: 'SMS_123456789',
      //   TemplateParam: JSON.stringify({ code })
      // });
      
      // 模拟发送成功
      console.log(`📱 发送短信到 ${phone}: ${message}`);
      
      return {
        success: true,
        message: '短信发送成功'
      };
      
    } catch (error) {
      console.error('短信发送失败:', error);
      return {
        success: false,
        message: error.message || '短信发送失败'
      };
    }
  }

  /**
   * 检查手机号格式
   */
  static validatePhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 获取验证码剩余有效时间
   */
  static async getCodeTTL(phone, type = 'login') {
    try {
      const codeKey = `sms:code:${phone}:${type}`;
      const storedData = memoryStore.get(codeKey);
      
      if (!storedData || storedData.expiry < Date.now()) {
        return 0;
      }
      
      // 返回剩余秒数
      return Math.floor((storedData.expiry - Date.now()) / 1000);
    } catch (error) {
      console.error('获取验证码TTL失败:', error);
      return 0;
    }
  }

  /**
   * 清理过期的验证码记录
   */
  static async cleanupExpiredCodes() {
    try {
      // Redis会自动清理过期的key，这里可以添加额外的清理逻辑
      console.log('清理过期验证码记录');
    } catch (error) {
      console.error('清理过期验证码失败:', error);
    }
  }
}

module.exports = SmsService;