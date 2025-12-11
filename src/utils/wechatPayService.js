/**
 * 微信支付服务工具类
 * 处理微信支付相关功能
 */

const crypto = require('crypto');
const axios = require('axios');

class WechatPayService {
  constructor() {
    this.appId = process.env.WECHAT_APP_ID;
    this.mchId = process.env.WECHAT_MCH_ID;
    this.apiKey = process.env.WECHAT_API_KEY;
    this.notifyUrl = process.env.WECHAT_NOTIFY_URL || 'https://your-domain.com/api/payments/wechat/notify';
    this.baseUrl = 'https://api.mch.weixin.qq.com';
  }

  /**
   * 创建统一下单
   */
  async createUnifiedOrder(orderData) {
    const {
      payment_no,
      amount,
      description,
      openid,
      trade_type = 'JSAPI',
      time_expire
    } = orderData;

    // 测试环境使用模拟支付
    if (process.env.NODE_ENV !== 'production') {
      return this.createMockOrder(orderData);
    }

    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      body: description,
      out_trade_no: payment_no,
      total_fee: Math.round(amount * 100), // 转换为分
      spbill_create_ip: '127.0.0.1',
      notify_url: this.notifyUrl,
      trade_type: trade_type,
      openid: openid
    };

    // 设置超时时间（格式：yyyyMMddHHmmss），仅当提供时
    if (time_expire) {
      params.time_expire = time_expire;
    }

    // 生成签名
    params.sign = this.generateSign(params);

    // 转换为XML
    const xml = this.objectToXml(params);

    try {
      const response = await axios.post(
        `${this.baseUrl}/pay/unifiedorder`,
        xml,
        {
          headers: {
            'Content-Type': 'application/xml'
          }
        }
      );

      const result = this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        // 生成小程序支付参数
        const payParams = this.generateMiniProgramPayParams(result.prepay_id);
        
        return {
          success: true,
          prepay_id: result.prepay_id,
          pay_params: payParams
        };
      } else {
        throw new Error(result.err_code_des || result.return_msg || '微信支付下单失败');
      }
    } catch (error) {
      console.error('微信支付下单失败:', error);
      throw new Error('微信支付下单失败');
    }
  }

  /**
   * 创建模拟订单（测试环境）
   */
  createMockOrder(orderData) {
    const { payment_no } = orderData;
    
    console.log(`📱 测试环境微信支付: ${payment_no}`);
    
    return {
      success: true,
      prepay_id: `mock_prepay_${Date.now()}`,
      pay_params: {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: this.generateNonceStr(),
        package: `prepay_id=mock_prepay_${Date.now()}`,
        signType: 'MD5',
        paySign: 'mock_sign_' + Date.now()
      },
      mock: true
    };
  }

  /**
   * 生成小程序支付参数
   */
  generateMiniProgramPayParams(prepayId) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const packageStr = `prepay_id=${prepayId}`;
    const signType = 'MD5';

    const params = {
      appId: this.appId,
      timeStamp,
      nonceStr,
      package: packageStr,
      signType
    };

    const paySign = this.generateSign(params);

    return {
      timeStamp,
      nonceStr,
      package: packageStr,
      signType,
      paySign
    };
  }

  /**
   * 验证支付回调
   */
  verifyNotify(xmlData) {
    try {
      const data = this.xmlToObject(xmlData);
      
      // 验证签名
      const sign = data.sign;
      delete data.sign;
      const calculatedSign = this.generateSign(data);
      
      if (sign !== calculatedSign) {
        throw new Error('签名验证失败');
      }

      // 验证返回状态
      if (data.return_code !== 'SUCCESS' || data.result_code !== 'SUCCESS') {
        throw new Error('支付失败');
      }

      return {
        success: true,
        payment_no: data.out_trade_no,
        transaction_id: data.transaction_id,
        total_fee: parseInt(data.total_fee) / 100, // 转换为元
        time_end: data.time_end,
        openid: data.openid
      };
    } catch (error) {
      console.error('微信支付回调验证失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 查询订单状态
   */
  async queryOrder(paymentNo) {
    // 测试环境返回模拟结果
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        trade_state: 'SUCCESS',
        transaction_id: `mock_${paymentNo}`,
        total_fee: 100
      };
    }

    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      out_trade_no: paymentNo,
      nonce_str: this.generateNonceStr()
    };

    params.sign = this.generateSign(params);
    const xml = this.objectToXml(params);

    try {
      const response = await axios.post(
        `${this.baseUrl}/pay/orderquery`,
        xml,
        {
          headers: {
            'Content-Type': 'application/xml'
          }
        }
      );

      const result = this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          trade_state: result.trade_state,
          transaction_id: result.transaction_id,
          total_fee: parseInt(result.total_fee) / 100
        };
      } else {
        throw new Error(result.err_code_des || result.return_msg || '查询订单失败');
      }
    } catch (error) {
      console.error('查询微信支付订单失败:', error);
      throw new Error('查询订单失败');
    }
  }

  /**
   * 申请退款
   */
  async refund(refundData) {
    const {
      payment_no,
      refund_no,
      total_fee,
      refund_fee,
      refund_desc = '用户申请退款'
    } = refundData;

    // 测试环境返回模拟结果
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 测试环境微信退款: ${refund_no}`);
      return {
        success: true,
        refund_id: `mock_refund_${Date.now()}`
      };
    }

    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: payment_no,
      out_refund_no: refund_no,
      total_fee: Math.round(total_fee * 100),
      refund_fee: Math.round(refund_fee * 100),
      refund_desc: refund_desc
    };

    params.sign = this.generateSign(params);
    const xml = this.objectToXml(params);

    try {
      const response = await axios.post(
        `${this.baseUrl}/secapi/pay/refund`,
        xml,
        {
          headers: {
            'Content-Type': 'application/xml'
          },
          // 这里需要配置证书
          // httpsAgent: new https.Agent({
          //   cert: fs.readFileSync('path/to/cert.pem'),
          //   key: fs.readFileSync('path/to/key.pem')
          // })
        }
      );

      const result = this.xmlToObject(response.data);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          refund_id: result.refund_id
        };
      } else {
        throw new Error(result.err_code_des || result.return_msg || '申请退款失败');
      }
    } catch (error) {
      console.error('微信退款失败:', error);
      throw new Error('申请退款失败');
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
   * 生成签名
   */
  generateSign(params) {
    // 排序参数
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
      .filter(key => params[key] !== undefined && params[key] !== '')
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const stringSignTemp = `${stringA}&key=${this.apiKey}`;
    
    return crypto
      .createHash('md5')
      .update(stringSignTemp, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  /**
   * 对象转XML
   */
  objectToXml(obj) {
    let xml = '<xml>';
    Object.keys(obj).forEach(key => {
      xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
    });
    xml += '</xml>';
    return xml;
  }

  /**
   * XML转对象
   */
  xmlToObject(xml) {
    const result = {};
    const regex = /<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>|<(\w+)>([\s\S]*?)<\/\3>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
      const key = match[1] || match[3];
      const value = match[2] || match[4];
      result[key] = value;
    }
    
    return result;
  }

  /**
   * 生成成功响应XML
   */
  generateSuccessResponse() {
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
  }

  /**
   * 生成失败响应XML
   */
  generateFailResponse(message = 'FAIL') {
    return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${message}]]></return_msg></xml>`;
  }
}

module.exports = WechatPayService;