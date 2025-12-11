-- 插入测试消息数据
USE pro_electrician;

-- 插入系统通知测试数据
INSERT INTO system_messages (title, content, type, target_users, status, created_at, updated_at) VALUES
('系统维护通知', '系统将于今晚22:00-24:00进行维护升级，期间可能影响部分功能使用，请您提前安排。', 'system', 'all', 'published', NOW(), NOW()),
('新功能上线', '平台新增在线支付功能，支持微信支付，让您的服务体验更便捷！', 'activity', 'all', 'published', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('安全提醒', '请注意保护个人信息安全，不要向他人透露验证码等敏感信息。', 'system', 'all', 'published', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('平台活动', '新用户注册即送优惠券，邀请好友还有额外奖励，快来参与吧！', 'activity', 'all', 'published', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('服务升级', '平台客服服务时间调整为9:00-21:00，为您提供更好的服务体验。', 'maintenance', 'all', 'published', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY));

-- 插入订单通知测试数据（urgent类型）
INSERT INTO system_messages (title, content, type, target_users, status, created_at, updated_at) VALUES
('工单状态更新', '您的工单#12345已被电工接单，电工将在30分钟内联系您。', 'urgent', 'all', 'published', NOW(), NOW()),
('服务完成通知', '您的工单#12344已完成服务，请及时确认并评价。', 'urgent', 'all', 'published', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
('支付成功通知', '您的工单#12343支付成功，金额￥150.00，感谢您的使用。', 'urgent', 'all', 'published', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('新工单提醒', '您有新的工单需要处理，请及时查看并响应。', 'urgent', 'all', 'published', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('工单取消通知', '您的工单#12342已被取消，如有疑问请联系客服。', 'urgent', 'all', 'published', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY));

SELECT '✅ 测试消息数据插入完成' as result;
SELECT '📨 系统通知数量:' as info, COUNT(*) as count FROM system_messages WHERE type IN ('system', 'maintenance', 'activity');
SELECT '🔔 订单通知数量:' as info, COUNT(*) as count FROM system_messages WHERE type = 'urgent';
SELECT '📊 总消息数量:' as info, COUNT(*) as count FROM system_messages;