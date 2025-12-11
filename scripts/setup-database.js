/**
 * 数据库初始化脚本
 * 执行数据库创建、表创建、索引创建和初始数据插入
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// 数据库连接配置（不指定数据库）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  timezone: '+08:00',
  multipleStatements: true
};

// 执行SQL文件
const executeSqlFile = async (connection, filePath) => {
  try {
    console.log(`📄 执行SQL文件: ${path.basename(filePath)}`);
    const sql = await fs.readFile(filePath, 'utf8');
    await connection.query(sql);
    console.log(`✅ ${path.basename(filePath)} 执行成功`);
  } catch (error) {
    console.error(`❌ ${path.basename(filePath)} 执行失败:`, error.message);
    throw error;
  }
};

// 主函数
const setupDatabase = async () => {
  let connection;
  
  try {
    console.log('🚀 开始初始化数据库...');
    
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 执行SQL文件
    const scriptsDir = __dirname;
    
    // 1. 创建数据库和表
    await executeSqlFile(connection, path.join(scriptsDir, 'init-database.sql'));
    
    // 2. 创建索引
    await executeSqlFile(connection, path.join(scriptsDir, 'create-indexes.sql'));
    
    // 3. 插入初始数据
    await executeSqlFile(connection, path.join(scriptsDir, 'insert-initial-data.sql'));
    
    console.log('🎉 数据库初始化完成！');
    console.log('📋 初始化内容:');
    console.log('   - 创建数据库: electrician_platform');
    console.log('   - 创建数据表: 11个核心表');
    console.log('   - 创建索引: 性能优化索引');
    console.log('   - 插入数据: 服务类型、管理员、系统配置');
    console.log('');
    console.log('🔑 默认管理员账号:');
    console.log('   用户名: admin');
    console.log('   密码: admin123');
    console.log('');
    console.log('📱 测试环境配置:');
    console.log('   测试验证码: 123456');
    console.log('   附近订单范围: 1000米');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
};

// 检查数据库连接
const checkConnection = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('💡 请检查以下配置:');
    console.log(`   - 数据库主机: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   - 用户名: ${dbConfig.user}`);
    console.log(`   - 密码: ${dbConfig.password ? '已设置' : '未设置'}`);
    console.log('   - 确保MySQL服务已启动');
    return false;
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    console.log('🔍 检查数据库连接...');
    const canConnect = await checkConnection();
    
    if (canConnect) {
      await setupDatabase();
    } else {
      process.exit(1);
    }
  })();
}

module.exports = {
  setupDatabase,
  checkConnection
};