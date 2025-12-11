/**
 * 检查 orders 表的评价相关列与枚举值是否存在
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  timezone: '+08:00',
};

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('✅ 已连接数据库');

    const cols = ['review_rating','review_comment','reviewed_at','completed_at'];
    for (const col of cols) {
      const [rows] = await conn.query(`SHOW COLUMNS FROM orders LIKE ?`, [col]);
      if (rows && rows.length > 0) {
        console.log(`✅ 列存在: ${col} -> ${rows[0].Type}`);
      } else {
        console.warn(`❌ 列缺失: ${col}`);
      }
    }

    const [statusRows] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'`
    );
    const statusType = statusRows[0]?.COLUMN_TYPE || '';
    console.log(`📋 status 枚举: ${statusType}`);
    const hasPendingReview = statusType.includes('pending_review');
    const hasPendingRepairPayment = statusType.includes('pending_repair_payment');
    console.log(`🔎 包含 pending_review: ${hasPendingReview}`);
    console.log(`🔎 包含 pending_repair_payment: ${hasPendingRepairPayment}`);
  } catch (err) {
    console.error('❌ 检查失败:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();