/**
 * 短信服务工具类
 * 处理短信验证码发送和验证
 */


const Core = require('@alicloud/pop-core');

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
      /** 测试模式，优先读取 .env 中的配置 */
      const isTestEnv = process.env.SMS_TEST_MODE === 'true'; // 优先读取 .env 中的配置

      console.log('--- SMS Debug Info ---');
      console.log('process.env.SMS_TEST_MODE:', process.env.SMS_TEST_MODE, 'Type:', typeof process.env.SMS_TEST_MODE);
      console.log('isTestEnv:', isTestEnv);
      console.log('----------------------');

      // 如果明确开启了测试模式，直接返回
      if (isTestEnv) {
        console.log(`📱 [测试模式] 短信验证码: ${phone} -> ${code}`);

        // 存储验证码到内存
        const codeKey = `sms:code:${phone}:${type}`;
        memoryStore.set(codeKey, {
          code: code,
          expiry: Date.now() + 300000 // 5分钟过期
        });

        // 记录发送时间
        memoryStore.set(lastSendKey, {
          timestamp: Date.now(),
          expiry: Date.now() + 60000
        });

        return {
          success: true,
          message: '验证码发送成功（测试环境）',
          code: code
        };
      }

      // 生产环境（或 SMS_TEST_MODE=false）调用真实短信服务
      // 存储验证码到内存（先存储，不论发送成功与否，防止并发？不，应该发送成功后再存？或者先存但如果发送失败再删？
      // 通常先存，但为了不仅防止攻击，还是先发送成功再存比较好？
      // 但这里为了逻辑简单，先发送，如果成功再存。

      const smsResult = await this.sendSms(phone, code, type);

      if (smsResult.success) {
        // 发送成功后才存储
        const codeKey = `sms:code:${phone}:${type}`;
        memoryStore.set(codeKey, {
          code: code,
          expiry: Date.now() + 300000
        });

        memoryStore.set(lastSendKey, {
          timestamp: Date.now(),
          expiry: Date.now() + 60000
        });

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
   * 发送短信（阿里云）
   */
  static async sendSms(phone, code, type) {
    try {
      if (!process.env.ALIYUN_ACCESS_KEY_ID || !process.env.ALIYUN_ACCESS_KEY_SECRET) {
        throw new Error('未配置阿里云短信密钥');
      }

      const client = new Core({
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
        endpoint: 'https://dysmsapi.aliyuncs.com',
        apiVersion: '2017-05-25'
      });

      const params = {
        "RegionId": "cn-hangzhou",
        "PhoneNumbers": phone,
        "SignName": process.env.ALIYUN_SMS_SIGN_NAME || '电工维修平台',
        "TemplateCode": process.env.ALIYUN_SMS_TEMPLATE_CODE,
        "TemplateParam": JSON.stringify({ code })
      };

      const requestOption = {
        method: 'POST',
        formatParams: false,
      };

      console.log('正在发送短信:', { phone, template: params.TemplateCode });

      const response = await client.request('SendSms', params, requestOption);

      if (response.Code === 'OK') {
        console.log('短信发送成功:', response);
        return {
          success: true,
          message: '短信发送成功'
        };
      } else {
        console.error('短信发送失败(阿里云返回):', response);
        return {
          success: false,
          message: response.Message || '短信发送失败'
        };
      }

    } catch (error) {
      console.error('短信发送异常:', error);
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