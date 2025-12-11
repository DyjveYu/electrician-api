-- 为支付记录新增支付类型，并扩充支付状态枚举加入 expired（超时未支付）
ALTER TABLE `payments`
ADD COLUMN `type` ENUM('prepay','repair') NOT NULL DEFAULT 'prepay' COMMENT '支付类型（预付款/维修费）' AFTER `payment_method`;

ALTER TABLE `payments`
MODIFY COLUMN `status` ENUM('pending','success','failed','refunded','expired') NOT NULL DEFAULT 'pending' COMMENT '支付状态';