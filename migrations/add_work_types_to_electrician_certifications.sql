-- 为电工认证表添加工作类型字段（支持多选）
-- 执行时间: 2025-12-13
-- 说明: 添加 work_types 字段，用于存储电工从事的工作类型（维修、安装，可多选）

USE pro_electrician;

-- 添加 work_types 字段
ALTER TABLE `electrician_certifications` 
ADD COLUMN `work_types` VARCHAR(100) NOT NULL DEFAULT 'maintenance' 
COMMENT '从事工作类型：逗号分隔，如：maintenance,installation' 
AFTER `user_id`;

-- 验证字段是否添加成功
SHOW COLUMNS FROM `electrician_certifications` LIKE 'work_types';

-- 如果需要回滚，执行以下命令：
-- ALTER TABLE `electrician_certifications` DROP COLUMN `work_types`;

