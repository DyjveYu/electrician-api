-- 1. 用户表新增 openid 字段
ALTER TABLE users ADD COLUMN openid VARCHAR(64) UNIQUE COMMENT '微信OpenID';

-- 2. 订单表状态新增 settled (已结算)
-- 注意：这里列出了所有现有状态，确保不会丢失
ALTER TABLE orders MODIFY COLUMN status ENUM('pending_payment', 'pending', 'accepted', 'in_progress', 'pending_review', 'completed', 'pending_repair_payment', 'paid', 'cancelled', 'cancel_pending', 'closed', 'settled') DEFAULT 'pending_payment' COMMENT '工单状态';

-- 3. 支付表类型新增 transfer (企业付款/转账)
ALTER TABLE payments MODIFY COLUMN type ENUM('prepay', 'repair', 'transfer') NOT NULL DEFAULT 'prepay' COMMENT '支付类型';
