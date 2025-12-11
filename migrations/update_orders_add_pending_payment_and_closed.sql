-- 扩充订单状态枚举，新增 pending_payment 与 closed，并添加预付款成功时间字段
ALTER TABLE `orders`
MODIFY COLUMN `status` ENUM('pending_payment','pending','accepted','in_progress','completed','paid','cancelled','cancel_pending','closed') NOT NULL DEFAULT 'pending_payment' COMMENT '工单状态';

ALTER TABLE `orders`
ADD COLUMN `prepaid_at` DATETIME NULL COMMENT '预付款支付成功时间' AFTER `completed_at`;