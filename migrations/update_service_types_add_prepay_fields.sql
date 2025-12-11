-- 为服务类型新增预付款金额与备注说明字段
ALTER TABLE `service_types`
ADD COLUMN `prepay_amount` DECIMAL(10,2) NULL COMMENT '预付款金额' AFTER `status`,
ADD COLUMN `prepay_note` TEXT NULL COMMENT '预付款备注说明' AFTER `prepay_amount`;