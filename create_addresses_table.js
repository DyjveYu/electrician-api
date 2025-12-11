const db = require('./src/config/database');

async function createAddressesTable() {
    try {
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS user_addresses (
                id INT PRIMARY KEY AUTO_INCREMENT COMMENT '地址ID',
                user_id INT NOT NULL COMMENT '用户ID',
                contact_name VARCHAR(50) NOT NULL COMMENT '联系人姓名',
                contact_phone VARCHAR(20) NOT NULL COMMENT '联系人电话',
                province VARCHAR(50) NOT NULL COMMENT '省份',
                city VARCHAR(50) NOT NULL COMMENT '城市',
                district VARCHAR(50) NOT NULL COMMENT '区县',
                detail_address VARCHAR(200) NOT NULL COMMENT '详细地址',
                longitude DECIMAL(10,7) DEFAULT NULL COMMENT '经度',
                latitude DECIMAL(10,7) DEFAULT NULL COMMENT '纬度',
                is_default BOOLEAN DEFAULT FALSE COMMENT '是否默认地址',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                INDEX idx_user_id (user_id),
                INDEX idx_is_default (is_default)
            ) COMMENT='用户地址表'
        `;
        
        await db.query(createTableSql);
        console.log('user_addresses表创建成功');
        
        // 验证表是否创建成功
        const result = await db.query('SHOW TABLES LIKE "user_addresses"');
        console.log('验证表存在:', result.length > 0 ? '是' : '否');
        
        if (result.length > 0) {
            const desc = await db.query('DESCRIBE user_addresses');
            console.log('表结构:');
            console.table(desc);
        }
        
    } catch (err) {
        console.error('创建表失败:', err);
    } finally {
        process.exit(0);
    }
}

createAddressesTable();