-- 添加needs_confirmation字段到orders表
ALTER TABLE orders ADD COLUMN needs_confirmation BOOLEAN DEFAULT false;