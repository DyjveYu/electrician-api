-- 创建用户消息已读记录表
CREATE TABLE IF NOT EXISTS user_message_reads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  message_id INT NOT NULL COMMENT '消息ID',
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_message (user_id, message_id),
  INDEX idx_user_id (user_id),
  INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户消息已读记录表';

-- 如果system_messages表不存在，创建它
CREATE TABLE IF NOT EXISTS system_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL COMMENT '消息标题',
  content TEXT NOT NULL COMMENT '消息内容',
  type ENUM('system', 'order', 'promotion') DEFAULT 'system' COMMENT '消息类型',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal' COMMENT '优先级',
  target_users TEXT COMMENT '目标用户ID列表，用逗号分隔，"all"表示所有用户',
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft' COMMENT '状态',
  scheduled_at TIMESTAMP NULL COMMENT '定时发送时间',
  created_by INT NULL COMMENT '创建者ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统消息表';

-- 如果system_messages表已存在，修改created_by字段允许NULL
ALTER TABLE system_messages MODIFY COLUMN created_by INT NULL COMMENT '创建者ID';

-- 插入一些示例系统通知数据
INSERT INTO system_messages (title, content, type, priority, target_users, status, created_by) VALUES
('平台维护通知', '系统将于今晚23:00-01:00进行维护升级，期间可能影响部分功能使用，请您提前安排。', 'maintenance', 'high', 'all', 'published', NULL),
('服务费用调整通知', '根据市场情况，部分服务项目费用将有所调整，具体请查看最新价格表。', 'system', 'medium', 'all', 'published', NULL),
('新功能上线通知', '我们新增了在线支付功能，现在您可以通过微信、支付宝等方式便捷支付。', 'system', 'medium', 'all', 'published', NULL),
('安全提醒', '请注意保护个人信息安全，不要向他人透露验证码等敏感信息。', 'urgent', 'high', 'all', 'published', NULL);

-- 插入一些示例活动通知数据
INSERT INTO system_messages (title, content, type, priority, target_users, status, created_by) VALUES
('订单已完成', '您的订单已完成，请对本次服务进行评价。', 'system', 'medium', 'all', 'published', NULL),
('师傅已接单', '李师傅已接受您的订单，预计30分钟后到达。', 'urgent', 'high', 'all', 'published', NULL),
('订单已派发', '您的卫生间明修订单已派发给附近师傅，请耐心等待。', 'system', 'medium', 'all', 'published', NULL),
('支付成功', '您已成功支付空调线路检查费用150元。', 'system', 'medium', 'all', 'published', NULL),
('订单已取消', '由于师傅临时有事，您的维修订单已取消，费用将原路退回。', 'urgent', 'high', 'all', 'published', NULL);