/**
 * 微信支付V3服务工具类 - 公钥验签模式
 * 使用微信支付公钥进行回调验签(官方推荐方式)
 */

const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class WechatPayV3Service {
  constructor() {
    // 基础配置
    this.appId = process.env.WECHAT_APP_ID;
    this.mchId = process.env.WECHAT_MCH_ID;
    this.mchSerialNo = process.env.WECHAT_MCH_SERIAL_NO; // 商户证书序列号
    this.apiV3Key = process.env.WECHAT_API_V3_KEY; // APIv3密钥

    // ⭐ 新增：微信支付平台证书序列号
    this.platformSerialNo = process.env.WECHAT_PLATFORM_SERIAL_NO;

    // 证书路径
    this.privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH;
    this.certificatePath = process.env.WECHAT_CERTIFICATE_PATH;
    this.publicKeyPath = process.env.WECHAT_PUBLIC_KEY_PATH || '/www/server/cert/wxpay/pub_key.pem';

    // 加载商户私钥(用于请求签名)
    this.privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');

    // 加载微信支付公钥(用于回调验签)
    try {
      this.wechatPublicKey = fs.readFileSync(this.publicKeyPath, 'utf8');
      console.log('✅ 微信支付公钥加载成功');
      
      // ⭐ 自动从公钥证书中提取序列号
      if (!this.platformSerialNo) {
        this.platformSerialNo = this.extractSerialNoFromCert(this.wechatPublicKey);
        if (this.platformSerialNo) {
          console.log('✅ 自动提取平台证书序列号:', this.platformSerialNo);
        }
      }
    } catch (error) {
      console.error('❌ 微信支付公钥加载失败:', error.message);
      this.wechatPublicKey = null;
    }

    // 基础URL
    this.baseUrl = 'https://api.mch.weixin.qq.com';
    this.notifyUrl = process.env.WECHAT_NOTIFY_URL;
    this.isSandbox = process.env.WECHAT_SANDBOX === 'true';

    // 调试日志
    console.log('微信支付配置检查(公钥验签模式):');
    console.log('- AppID:', this.appId);
    console.log('- MchID:', this.mchId);
    console.log('- MchSerialNo:', this.mchSerialNo ? '已配置' : '❌ 未配置');
    console.log('- PlatformSerialNo:', this.platformSerialNo ? `已配置 (${this.platformSerialNo})` : '❌ 未配置');
    console.log('- APIv3Key:', this.apiV3Key ? '已配置' : '❌ 未配置');
    console.log('- 商户私钥:', this.privateKeyPath, this.privateKey ? '✅ 加载成功' : '❌ 加载失败');
    console.log('- 商户证书:', this.certificatePath);
    console.log('- 微信公钥:', this.publicKeyPath, this.wechatPublicKey ? '✅ 加载成功' : '❌ 加载失败');
    console.log('- isSandbox:', this.isSandbox);
  }

  /**
   * ⭐ 从证书文件中提取序列号
   */
  extractSerialNoFromCert(certContent) {
    try {
      // 尝试作为完整证书解析
      const cert = new crypto.X509Certificate(certContent);
      return cert.serialNumber.replace(/:/g, '').toUpperCase();
    } catch (error) {
      console.warn('⚠️ 无法从公钥文件提取序列号，可能不是完整证书格式');
      return null;
    }
  }

  /**
   * 创建JSAPI支付订单
   */
  async createJsapiOrder(orderData) {
    const {
      description,
      out_trade_no,
      amount,
      openid,
      time_expire
    } = orderData;

    if (this.isSandbox) {
      console.log('🟡 使用沙箱环境创建支付订单');
      return this.createMockJsapiOrder(orderData);
    }

    try {
      const requestData = {
        appid: this.appId,
        mchid: this.mchId,
        description,
        out_trade_no,
        time_expire: time_expire || this.generateExpireTime(30),
        notify_url: this.notifyUrl,
        amount: {
          total: Math.round(amount * 100),
          currency: 'CNY'
        },
        payer: {
          openid
        }
      };

      const url = '/v3/pay/transactions/jsapi';
      const response = await this.request('POST', url, requestData);

      if (response.status === 200) {
        const result = response.data;
        const payParams = this.generateJsapiPayParams(result.prepay_id, this.appId);

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
   */
  generateJsapiPayParams(prepayId, appId = this.appId) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr(32);
    const packageStr = `prepay_id=${prepayId}`;

    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;

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
      appId
    };
  }

  /**
   * 处理支付结果通知 - 公钥验签模式
   */
  async handlePaymentNotify(headers, body) {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📥 处理微信支付回调(公钥验签模式)');
      console.log('='.repeat(80));

      if (!this.wechatPublicKey) {
        throw new Error('微信支付公钥未加载，无法验签');
      }

      const signature = headers['wechatpay-signature'];
      const serial = headers['wechatpay-serial'];
      const nonce = headers['wechatpay-nonce'];
      const timestamp = headers['wechatpay-timestamp'];

      console.log('📋 回调签名信息:');
      console.log('  - Serial:', serial);
      console.log('  - Timestamp:', timestamp);
      console.log('  - Nonce:', nonce);
      console.log('  - Signature:', signature ? signature.substring(0, 50) + '...' : '无');

      if (!signature || !serial || !nonce || !timestamp) {
        throw new Error('缺少必要的签名参数');
      }

      const bodyString = JSON.stringify(body);
      const verifyString = `${timestamp}\n${nonce}\n${bodyString}\n`;

      console.log('-'.repeat(80));
      console.log('🔐 验签字符串:');
      console.log(verifyString.split('\n').map((line, i) =>
        `  ${i + 1}. ${line || '(空行)'}`
      ).join('\n'));
      console.log('-'.repeat(80));

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(verifyString);
      const isValid = verifier.verify(this.wechatPublicKey, signature, 'base64');

      if (!isValid) {
        console.error('❌ 签名验证失败');
        throw new Error('支付通知签名验证失败');
      }

      console.log('✅ 签名验证通过');

      const { resource } = body;
      if (!resource) {
        throw new Error('回调数据缺少resource字段');
      }

      console.log('🔓 开始解密回调数据...');
      const decryptedData = this.decryptAES256GCM(
        resource.ciphertext,
        resource.associated_data,
        resource.nonce
      );

      const paymentData = JSON.parse(decryptedData);

      console.log('✅ 微信回调数据解密成功:');
      console.log('  - 商户订单号:', paymentData.out_trade_no);
      console.log('  - 微信订单号:', paymentData.transaction_id);
      console.log('  - 交易状态:', paymentData.trade_state);
      console.log('  - 交易描述:', paymentData.trade_state_desc);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        out_trade_no: paymentData.out_trade_no,
        transaction_id: paymentData.transaction_id,
        trade_state: paymentData.trade_state,
        success_time: paymentData.success_time,
        decrypted_data: paymentData
      };

    } catch (error) {
      console.error('❌ 支付通知处理失败:', error.message);
      console.log('='.repeat(80) + '\n');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 创建模拟订单(测试环境)
   */
  createMockJsapiOrder(orderData) {
    const { out_trade_no, amount, description } = orderData;
    console.log(`📱 测试环境创建模拟支付订单: ${out_trade_no}, 金额: ${amount}元, 描述: ${description}`);

    const mockPrepayId = `mock_prepay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * ⭐ 发起商家转账 (V3 新版接口 /v3/fund-app/mch-transfer/transfer-bills)
   * 适用于已开通"商家转账到零钱"产品的商户
   */
  async createTransferBill(transferData) {
    const {
      out_bill_no,
      transfer_scene_id,
      openid,
      user_name,
      transfer_amount,
      transfer_remark,
      notify_url,
      user_recv_perception,
      transfer_scene_report_infos
    } = transferData;

    const safeOutBillNo = String(out_bill_no || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 32);

    if (this.isSandbox) {
      console.log(`📱 测试环境发起商家转账: ${safeOutBillNo}, 金额: ${transfer_amount}元, OpenID: ${openid}`);
      return {
        success: true,
        out_bill_no: safeOutBillNo,
        transfer_bill_no: `mock_bill_${Date.now()}`,
        state: 'WAIT_USER_CONFIRM',
        package_info: 'mock_package_info',
        mock: true
      };
    }

    try {
      const requestData = {
        appid: this.appId,
        out_bill_no: safeOutBillNo,
        transfer_scene_id: transfer_scene_id || '1000',
        openid,
        transfer_amount: Math.round(transfer_amount * 100),
        transfer_remark: transfer_remark || '劳务报酬',
        ...(user_name && { user_name: this.encryptSensitiveField(user_name) }),
        ...(notify_url && { notify_url }),
        ...(user_recv_perception && { user_recv_perception }),
        transfer_scene_report_infos: transfer_scene_report_infos || [
          {
            info_type: '岗位类型',
            info_content: '电工'
          },
          {
            info_type: '报酬说明',
            info_content: '维修安装服务费'
          }
        ]
      };

      console.log('🚀 发起商家转账请求:', JSON.stringify(requestData, null, 2));

      const url = '/v3/fund-app/mch-transfer/transfer-bills';
      const response = await this.request('POST', url, requestData);

      if (response.status === 200 || response.status === 202) {
        return {
          success: true,
          ...response.data
        };
      } else {
        throw new Error(`转账请求返回异常状态码: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ 商家转账发起失败:', error.response?.data || error.message);
      throw new Error(`转账失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 敏感字段加密 (使用微信支付公钥 RSA/OAEP/2048/SHA-1/MGF1)
   */
  encryptSensitiveField(str) {
    if (!this.wechatPublicKey) {
      throw new Error('未加载微信支付公钥，无法加密敏感字段');
    }
    try {
      const buffer = Buffer.from(str, 'utf8');
      const encrypted = crypto.publicEncrypt({
        key: this.wechatPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      }, buffer);
      return encrypted.toString('base64');
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('敏感字段加密失败');
    }
  }

  /**
   * [已废弃] 发起商家转账到零钱 (旧版 V3 /v3/transfer/batches)
   * @deprecated 请使用 createTransferBill 替代
   */
  async createTransfer(transferData) {
    console.warn('⚠️ createTransfer 已废弃，请迁移至 createTransferBill');
    
    const {
      out_batch_no,
      batch_name,
      batch_remark,
      total_amount,
      openid
    } = transferData;

    const safeOutBatchNo = String(out_batch_no || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 32);
    const safeOutDetailNo = `${safeOutBatchNo.slice(0, 30)}01`;

    if (this.isSandbox) {
      console.log(`📱 测试环境商家转账: ${safeOutBatchNo}, 金额: ${total_amount}元, OpenID: ${openid}`);
      return {
        success: true,
        out_batch_no: safeOutBatchNo,
        batch_id: `mock_batch_${Date.now()}`,
        mock: true
      };
    }

    try {
      const requestData = {
        appid: this.appId,
        out_batch_no: safeOutBatchNo,
        batch_name,
        batch_remark,
        total_amount: Math.round(total_amount * 100),
        total_num: 1,
        transfer_detail_list: [
          {
            out_detail_no: safeOutDetailNo,
            transfer_amount: Math.round(total_amount * 100),
            transfer_remark: batch_remark,
            openid
          }
        ]
      };

      const url = '/v3/transfer/batches';
      const response = await this.request('POST', url, requestData);

      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('商家转账失败:', error.response?.data || error.message);
      throw new Error(`转账失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * ⭐ 通用V3接口请求方法 (修复版 - 添加 Wechatpay-Serial)
   */
  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr(32);
    const body = data ? JSON.stringify(data) : '';

    const signString = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signString);
    sign.end();
    const signature = sign.sign(this.privateKey, 'base64');

    const authHeader = this.buildAuthorizationHeader(timestamp, nonceStr, signature);

    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `WechatPay-NodeJS/1.0 (${this.mchId})`
    };

    // ⭐ 关键修复：添加微信支付平台证书序列号
    if (this.platformSerialNo) {
      headers['Wechatpay-Serial'] = this.platformSerialNo;
    } else {
      console.warn('⚠️ 未配置 WECHAT_PLATFORM_SERIAL_NO，部分接口可能失败');
    }

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
      console.error('❌ 请求失败:', {
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
    let mchSerialNo = this.mchSerialNo;

    if (!mchSerialNo) {
      mchSerialNo = this.getCertificateSerialNo();
    }

    mchSerialNo = mchSerialNo.replace(/:/g, '').toUpperCase();

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
   * AES-256-GCM解密
   */
  decryptAES256GCM(ciphertext, associatedData, nonce) {
    try {
      const key = Buffer.from(this.apiV3Key, 'utf8');
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

      const authTag = ciphertextBuffer.slice(-16);
      const encryptedData = ciphertextBuffer.slice(0, -16);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(nonce, 'utf8')
      );

      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('❌ AES-256-GCM解密失败:', error);
      throw new Error(`解密失败: ${error.message}`);
    }
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
    return date.toISOString().replace(/\.\d{3}Z$/, '+08:00');
  }

  /**
   * 生成成功响应
   */
  generateSuccessResponse() {
    return {
      code: 'SUCCESS',
      message: '成功'
    };
  }

  /**
   * 生成失败响应
   */
  generateFailResponse(message = '失败') {
    return {
      code: 'FAIL',
      message
    };
  }
}

module.exports = WechatPayV3Service;