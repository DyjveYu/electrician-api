-- 更新订单表状态字段，添加cancel_pending状态
ALTER TABLE `orders` 
MODIFY COLUMN `status` ENUM('pending', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled', 'cancel_pending') NOT NULL DEFAULT 'pending' COMMENT '工单状态';

-- 添加新的取消订单相关字段
ALTER TABLE `orders`
ADD COLUMN `cancel_initiator_id` INT NULL COMMENT '取消请求发起人ID' AFTER `cancel_reason`,
ADD COLUMN `cancel_initiated_at` DATETIME NULL COMMENT '取消请求发起时间' AFTER `cancel_initiator_id`,
ADD COLUMN `cancel_confirm_status` ENUM('pending', 'confirmed', 'rejected', 'no_confirm_req') NULL COMMENT '取消确认状态' AFTER `cancel_initiated_at`,
ADD COLUMN `cancel_confirmer_id` INT NULL COMMENT '取消请求确认人ID' AFTER `cancel_confirm_status`,
ADD COLUMN `cancel_confirmed_at` DATETIME NULL COMMENT '取消请求确认时间' AFTER `cancel_confirmer_id`;

-- 如果存在旧字段，则删除（如果之前已经创建过这些字段）
-- 注意：如果这些字段不存在，会报错，可以根据实际情况选择是否执行
-- ALTER TABLE `orders` 
-- DROP COLUMN IF EXISTS `cancel_initiated`,
-- DROP COLUMN IF EXISTS `cancel_initiator`,
-- DROP COLUMN IF EXISTS `cancel_confirmed`,
-- DROP COLUMN IF EXISTS `cancel_confirmer`;