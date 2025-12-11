/**
 * 微信支付V3服务工具类
 * 注意：V3接口使用JSON格式，签名方式为RSA-SHA256，平台证书需要定期更新
 */

const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class WechatPayV3Service {
  constructor() {
    // 基础配置 - 请确保在环境变量中设置这些值
    this.appId = process.env.WECHAT_APP_ID || 'wx5aa758717e06fc40';
    this.mchId = process.env.WECHAT_MCH_ID || '1733197522';
    this.mchSerialNo = process.env.WECHAT_MCH_SERIAL_NO; // 商户证书序列号
    this.apiV3Key = process.env.WECHAT_API_V3_KEY; // APIv3密钥，在商户平台API安全设置
    
    // 证书路径 - 请根据实际路径修改
    this.privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH || '/www/server/cert/wxpay/apiclient_key.pem';
    this.certificatePath = process.env.WECHAT_CERTIFICATE_PATH || '/www/server/cert/wxpay/apiclient_cert.pem';
    
    // 加载私钥（用于请求签名）
    this.privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
    
    // 基础URL
    this.baseUrl = 'https://api.mch.weixin.qq.com';
    this.baseUrlSandbox = 'https://api.mch.weixin.qq.com/sandboxnew'; // 沙箱环境
    
    // 通知地址
    this.notifyUrl = process.env.WECHAT_NOTIFY_URL || 'https://www.mijutime.com/api/payments/wechat/notify';
    
    // 是否为沙箱环境 - 仅通过 WECHAT_SANDBOX 控制，不再依赖 NODE_ENV
    this.isSandbox = process.env.WECHAT_SANDBOX === 'true';
    
    // 平台证书缓存（需要定期从微信获取）
    this.platformCertificates = {};

    // 调试日志
    console.log('微信支付配置检查:');
    console.log('- AppID:', this.appId);
    console.log('- MchID:', this.mchId);
    console.log('- MchSerialNo:', this.mchSerialNo ? '已配置' : '❌ 未配置');
    console.log('- APIv3Key:', this.apiV3Key ? '已配置' : '❌ 未配置');
    console.log('- 私钥文件:', this.privateKeyPath, this.privateKey ? '✅ 加载成功' : '❌ 加载失败');
    console.log('- 证书文件:', this.certificatePath);
    console.log('- isSandbox:', this.isSandbox);
  }
  

  /**
   * 创建JSAPI支付订单
   * @param {Object} orderData 订单数据
   * @returns {Object} 支付参数
   */
  async createJsapiOrder(orderData) {
    const {
      description,
      out_trade_no,
      amount, // 单位：元
      openid,
      time_expire
    } = orderData;

    // 测试环境使用模拟支付
    if (this.isSandbox) {
      console.log('🟡 使用沙箱环境创建支付订单');
      return this.createMockJsapiOrder(orderData);
    }

    try {
      // 1. 构建请求数据
      const requestData = {
        appid: this.appId,
        mchid: this.mchId,
        description,
        out_trade_no,
        time_expire: time_expire || this.generateExpireTime(30), // 30分钟后过期
        notify_url: this.notifyUrl,
        amount: {
          total: Math.round(amount * 100), // 转换为分
          currency: 'CNY'
        },
        payer: {
          openid
        }
      };

      // 2. 发送请求到微信支付V3接口
      const url = '/v3/pay/transactions/jsapi';
      const response = await this.request('POST', url, requestData);
      
      if (response.status === 200) {
        const result = response.data;
        
        // 3. 生成小程序支付参数（需要重新签名）
        const payParams = this.generateJsapiPayParams(
          result.prepay_id,
          this.appId
        );
        
        return {
          success: true,
          prepay_id: result.prepay_id,
          pay_params: payParams,
          out_trade_no
        };
      } else {
        throw new Error(`微信支付下单失败: ${response.status}`);
      }
    } catch (error) {
      console.error('微信支付V3下单失败:', error.response?.data || error.message);
      throw new Error(`微信支付下单失败: ${error.message}`);
    }
  }

  /**
   * 生成小程序支付参数包
   * V3接口的签名规则：对appId、timeStamp、nonceStr、package进行签名
   */
  generateJsapiPayParams(prepayId, appId = this.appId) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr(32);
    const packageStr = `prepay_id=${prepayId}`;
    
    // 构建签名字符串（注意参数顺序和大小写）
    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    
    // 使用商户私钥进行SHA256-RSA签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();
    const paySign = sign.sign(this.privateKey, 'base64');
    
    return {
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign,
      appId // 小程序端需要appId参数
    };
  }

  /**
   * 处理支付结果通知
   * V3接口的通知是JSON格式，需要验证签名
   */
  async handlePaymentNotify(headers, body) {
    try {
      // 1. 验证通知签名
      const signature = headers['wechatpay-signature'];
      const serial = headers['wechatpay-serial'];
      const nonce = headers['wechatpay-nonce'];
      const timestamp = headers['wechatpay-timestamp'];
      const bodyString = JSON.stringify(body);
      
      // 构建验签字符串
      const verifyString = `${timestamp}\n${nonce}\n${bodyString}\n`;
      
      // 2. 获取平台公钥验证签名（需要先获取平台证书）
      const publicKey = await this.getPlatformPublicKey(serial);
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(verifyString);
      const isValid = verifier.verify(publicKey, signature, 'base64');
      
      if (!isValid) {
        throw new Error('支付通知签名验证失败');
      }
      
      // 3. 处理业务逻辑
      const {
        resource: {
          ciphertext,
          associated_data,
          nonce: resource_nonce
        },
        out_trade_no,
        transaction_id,
        trade_state,
        success_time
      } = body;
      
      // 4. 解密资源数据（如果需要获取更多信息）
      const decryptedData = this.decryptAES256GCM(
        ciphertext,
        associated_data,
        resource_nonce
      );
      
      return {
        success: true,
        out_trade_no,
        transaction_id,
        trade_state,
        success_time,
        decrypted_data: JSON.parse(decryptedData)
      };
      
    } catch (error) {
      console.error('支付通知处理失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取平台证书（需要定期更新）
   */
  async getPlatformCertificates() {
    try {
      const url = '/v3/certificates';
      const response = await this.request('GET', url);
      
      if (response.status === 200) {
        const certificates = response.data.data;
        certificates.forEach(cert => {
          const { serial_no, effective_time, expire_time, encrypt_certificate } = cert;
          
          // 解密证书
          const decrypted = this.decryptAES256GCM(
            encrypt_certificate.ciphertext,
            encrypt_certificate.associated_data,
            encrypt_certificate.nonce
          );
          
          this.platformCertificates[serial_no] = {
            cert: decrypted,
            effective_time,
            expire_time
          };
        });
        
        return this.platformCertificates;
      }
    } catch (error) {
      console.error('获取平台证书失败:', error);
      // 可以在这里添加证书缓存逻辑
    }
    
    return null;
  }

  /**
   * 获取平台公钥
   */
  async getPlatformPublicKey(serialNo) {
    // 如果缓存中有且未过期，直接使用
    if (this.platformCertificates[serialNo]) {
      const cert = this.platformCertificates[serialNo].cert;
      const certObj = new crypto.X509Certificate(cert);
      return certObj.publicKey.export({ type: 'spki', format: 'pem' });
    }
    
    // 否则重新获取证书
    await this.getPlatformCertificates();
    
    if (this.platformCertificates[serialNo]) {
      const cert = this.platformCertificates[serialNo].cert;
      const certObj = new crypto.X509Certificate(cert);
      return certObj.publicKey.export({ type: 'spki', format: 'pem' });
    }
    
    throw new Error(`未找到序列号为${serialNo}的平台证书`);
  }

  /**
   * 创建模拟订单（用于测试环境）
   */
  createMockJsapiOrder(orderData) {
    const { out_trade_no, amount, description } = orderData;
    
    console.log(`📱 测试环境创建模拟支付订单: ${out_trade_no}, 金额: ${amount}元, 描述: ${description}`);
    
    // 生成模拟的prepay_id
    const mockPrepayId = `mock_prepay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 生成支付参数
    const payParams = this.generateJsapiPayParams(mockPrepayId);
    
    return {
      success: true,
      prepay_id: mockPrepayId,
      pay_params: payParams,
      out_trade_no,
      mock: true
    };
  }

  /**
   * 查询订单状态
   */
  async queryOrder(outTradeNo) {
    if (this.isSandbox) {
      return {
        success: true,
        trade_state: 'SUCCESS',
        transaction_id: `mock_${outTradeNo}`,
        amount: { total: 100 }
      };
    }
    
    try {
      const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.mchId}`;
      const response = await this.request('GET', url);
      
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('查询订单失败:', error);
      throw new Error(`查询订单失败: ${error.message}`);
    }
  }

  /**
   * 发起退款
   */
  async createRefund(refundData) {
    const {
      out_trade_no,
      out_refund_no,
      amount,
      reason = '用户申请退款'
    } = refundData;
    
    if (this.isSandbox) {
      console.log(`📱 测试环境微信退款: ${out_refund_no}`);
      return {
        success: true,
        refund_id: `mock_refund_${Date.now()}`
      };
    }
    
    try {
      const requestData = {
        transaction_id: refundData.transaction_id,
        out_trade_no,
        out_refund_no,
        reason,
        amount: {
          refund: Math.round(amount.refund * 100),
          total: Math.round(amount.total * 100),
          currency: 'CNY'
        }
      };
      
      const url = '/v3/refund/domestic/refunds';
      const response = await this.request('POST', url, requestData);
      
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('退款失败:', error);
      throw new Error(`退款失败: ${error.message}`);
    }
  }

  /**
   * 通用的V3接口请求方法（自动处理签名和认证）
   */
  async request(method, path, data = null) {
    const url = this.isSandbox ? 
      `${this.baseUrlSandbox}${path}` : 
      `${this.baseUrl}${path}`;
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr(32);
    const body = data ? JSON.stringify(data) : '';
    
    // 构建签名串 - 注意：这里应该使用 path 而不是完整 url
    let signString = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;
    
    // 使用商户私钥进行SHA256-RSA签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signString);
    sign.end();
    const signature = sign.sign(this.privateKey, 'base64');
    
    // 构建Authorization头
    const authHeader = this.buildAuthorizationHeader(
      timestamp,
      nonceStr,
      signature
    );
    
    // 配置请求头
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `WechatPay-NodeJS/1.0 (${this.mchId})`
    };
    
    // 发送请求
    const config = {
      method,
      url,
      headers,
      timeout: 10000
    };
    
    if (body && method !== 'GET') {
      config.data = body;
    }
    
    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      console.error('微信支付V3接口请求失败:', {
        url,
        method,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * 构建Authorization请求头
   */
  buildAuthorizationHeader(timestamp, nonceStr, signature) {
    const mchSerialNo = this.mchSerialNo || this.getCertificateSerialNo();
    
    return `WECHATPAY2-SHA256-RSA2048 ` +
           `mchid="${this.mchId}",` +
           `serial_no="${mchSerialNo}",` +
           `nonce_str="${nonceStr}",` +
           `timestamp="${timestamp}",` +
           `signature="${signature}"`;
  }

  /**
   * 从证书中提取序列号
   */
  getCertificateSerialNo() {
    try {
      const certContent = fs.readFileSync(this.certificatePath, 'utf8');
      const cert = new crypto.X509Certificate(certContent);
      return cert.serialNumber;
    } catch (error) {
      console.error('获取证书序列号失败:', error);
      return '';
    }
  }

  /**
   * AES-256-GCM解密（用于解密平台证书和支付通知）
   */
  decryptAES256GCM(ciphertext, associatedData, nonce) {
    const key = Buffer.from(this.apiV3Key, 'utf8');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(nonce, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(ciphertext.slice(-16), 'base64'));
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    
    const encrypted = Buffer.from(ciphertext.slice(0, -16), 'base64');
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * 生成随机字符串
   */
  generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成订单过期时间
   */
  generateExpireTime(minutes = 30) {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString().replace(/\.\d{3}Z$/, '+08:00'); // 北京时间格式
  }

  /**
   * 生成成功响应（用于支付通知）
   */
  generateSuccessResponse() {
    return {
      code: 'SUCCESS',
      message: '成功'
    };
  }

  /**
   * 生成失败响应（用于支付通知）
   */
  generateFailResponse(message = '失败') {
    return {
      code: 'FAIL',
      message
    };
  }
}

module.exports = WechatPayV3Service;