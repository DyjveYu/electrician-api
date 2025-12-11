
/**
 * ⚠️ 此文件已废弃
 * 2025年10月9日 起
 * 请使用 src/config/database.js 或 src/config/sequelize.js
 * 
 * 迁移说明：
 * - 原有 pool 配置已移至 src/config/database.js
 * - 新代码请使用 Sequelize: src/config/sequelize.js
 * 
 * 此文件保留用于兼容性，将在下个版本删除
 */

/**
 * 数据库连接配置
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'electrician_platform',
  charset: 'utf8mb4',
  timezone: '+08:00',
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  idleTimeout: 300000,
  ssl: false
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
};

// 执行查询
const query = async (sql, params = []) => {
  const startTime = Date.now();
  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`慢查询警告: ${duration}ms - ${sql.substring(0, 100)}...`);
    }
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`数据库查询错误 (${duration}ms):`, error.message);
    console.error('SQL:', sql.substring(0, 200));
    throw error;
  }
};

// 执行事务
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// 获取连接（用于复杂操作）
const getConnection = async () => {
  return await pool.getConnection();
};

// 关闭连接池
const closePool = async () => {
  await pool.end();
  console.log('数据库连接池已关闭');
};

// 重定向到新位置
module.exports = require('../src/config/database');