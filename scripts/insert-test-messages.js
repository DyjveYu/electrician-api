/**
 * 插入测试消息数据脚本
 */

const { query } = require('../src/config/database');

async function insertTestMessages() {
  try {
    console.log('开始插入测试消息数据...');
    
    // 插入系统通知测试数据
    const systemMessages = [
      {
        title: '系统维护通知',
        content: '系统将于今晚22:00-24:00进行维护升级，期间可能影响部分功能使用，请您提前安排。',
        type: 'system',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '新功能上线',
        content: '平台新增在线支付功能，支持微信支付，让您的服务体验更便捷！',
        type: 'activity',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '安全提醒',
        content: '请注意保护个人信息安全，不要向他人透露验证码等敏感信息。',
        type: 'system',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '平台活动',
        content: '新用户注册即送优惠券，邀请好友还有额外奖励，快来参与吧！',
        type: 'activity',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '服务升级',
        content: '平台客服服务时间调整为9:00-21:00，为您提供更好的服务体验。',
        type: 'maintenance',
        target_users: 'all',
        status: 'published'
      }
    ];
    
    // 插入订单通知测试数据（urgent类型）
    const orderMessages = [
      {
        title: '工单状态更新',
        content: '您的工单#12345已被电工接单，电工将在30分钟内联系您。',
        type: 'urgent',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '服务完成通知',
        content: '您的工单#12344已完成服务，请及时确认并评价。',
        type: 'urgent',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '支付成功通知',
        content: '您的工单#12343支付成功，金额￥150.00，感谢您的使用。',
        type: 'urgent',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '新工单提醒',
        content: '您有新的工单需要处理，请及时查看并响应。',
        type: 'urgent',
        target_users: 'all',
        status: 'published'
      },
      {
        title: '工单取消通知',
        content: '您的工单#12342已被取消，如有疑问请联系客服。',
        type: 'urgent',
        target_users: 'all',
        status: 'published'
      }
    ];
    
    // 合并所有消息
    const allMessages = [...systemMessages, ...orderMessages];
    
    // 批量插入消息
    for (const message of allMessages) {
      await query(
        `INSERT INTO system_messages (title, content, type, target_users, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [message.title, message.content, message.type, message.target_users, message.status]
      );
    }
    
    // 统计插入结果
    const systemCount = await query(
      "SELECT COUNT(*) as count FROM system_messages WHERE type IN ('system', 'maintenance', 'activity')"
    );
    
    const orderCount = await query(
      "SELECT COUNT(*) as count FROM system_messages WHERE type = 'urgent'"
    );
    
    const totalCount = await query(
      "SELECT COUNT(*) as count FROM system_messages"
    );
    
    console.log('✅ 测试消息数据插入完成');
    console.log(`📨 系统通知数量: ${systemCount[0].count}`);
    console.log(`🔔 订单通知数量: ${orderCount[0].count}`);
    console.log(`📊 总消息数量: ${totalCount[0].count}`);
    
  } catch (error) {
    console.error('❌ 插入测试消息数据失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行插入操作
insertTestMessages();