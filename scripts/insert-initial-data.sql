-- 插入初始数据
USE pro_electrician;

-- 插入服务类型
INSERT INTO service_types (name, description, sort_order) VALUES
('电路维修', '家庭电路故障检修，包括短路、断路等问题', 1),
('开关插座', '开关插座安装、维修、更换', 2),
('灯具安装', '各类灯具安装、维修、更换', 3),
('电器维修', '家用电器维修、保养', 4),
('其他电工服务', '其他电工相关服务', 5);

-- 插入管理员账号（密码为 admin123，已加密）
INSERT INTO admins (username, password, real_name, email) VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '系统管理员', 'admin@electrician-platform.com');

-- 插入系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('nearby_distance', '1000', '附近订单距离范围(米)'),
('message_poll_interval', '30', '消息轮询间隔(秒)'),
('max_image_size', '10485760', '图片最大大小(字节)'),
('max_image_count', '10', '最大图片数量'),
('supported_image_types', 'jpg,png,jpeg', '支持的图片格式'),
('test_sms_code', '123456', '测试环境短信验证码'),
('platform_name', '电工维修平台', '平台名称'),
('contact_phone', '400-123-4567', '客服电话'),
('privacy_policy_url', 'https://example.com/privacy', '隐私政策链接');

-- 插入测试用户数据（可选）
-- INSERT INTO users (phone, nickname, current_role) VALUES
-- ('13800138000', '测试用户', 'user'),
-- ('13900139000', '测试电工', 'electrician');

SELECT '✅ 初始数据插入完成' as result;
SELECT '📊 服务类型数量:' as info, COUNT(*) as count FROM service_types;
SELECT '👤 管理员数量:' as info, COUNT(*) as count FROM admins;
SELECT '⚙️ 系统配置数量:' as info, COUNT(*) as count FROM system_configs;