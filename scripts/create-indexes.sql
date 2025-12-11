-- 创建数据库索引
USE electrician_platform;

-- 用户表索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_current_role ON users(current_role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_can_be_electrician ON users(can_be_electrician);

-- 电工表索引
CREATE INDEX idx_electricians_user_id ON electricians(user_id);
CREATE INDEX idx_electricians_certification_status ON electricians(certification_status);
CREATE INDEX idx_electricians_service_area ON electricians(service_area);
CREATE INDEX idx_electricians_status_created ON electricians(certification_status, created_at);

-- 工单表索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_electrician_id ON orders(electrician_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_location ON orders(longitude, latitude);
CREATE INDEX idx_orders_service_type ON orders(service_type_id);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- 消息表索引
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_user_type ON messages(user_id, type);
CREATE INDEX idx_messages_user_read ON messages(user_id, is_read);

-- 支付记录索引
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_out_trade_no ON payments(out_trade_no);

-- 评价表索引
CREATE INDEX idx_reviews_order_id ON reviews(order_id);
CREATE INDEX idx_reviews_electrician_id ON reviews(electrician_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- 地址表索引
CREATE INDEX idx_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_addresses_default ON user_addresses(user_id, is_default);

-- 认证表索引
CREATE INDEX idx_certifications_user_id ON electrician_certifications(user_id);
CREATE INDEX idx_certifications_status ON electrician_certifications(status);

-- 工单状态日志索引
CREATE INDEX idx_status_logs_order_id ON order_status_logs(order_id);
CREATE INDEX idx_status_logs_created_at ON order_status_logs(created_at);

-- 系统配置索引
CREATE INDEX idx_system_configs_key ON system_configs(config_key);

SELECT '✅ 数据库索引创建完成' as result;