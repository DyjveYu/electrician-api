// src/config/sequelize.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',

    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    logging: false, // process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '+08:00',

    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// 测试连接
sequelize.authenticate()
  .then(() => console.log('✅ 数据库连接成功'))
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
  });

module.exports = sequelize;