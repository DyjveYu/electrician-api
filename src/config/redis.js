/**
 * Redis连接配置
 * 封装Redis常用操作方法
 */

const redis = require('redis');
require('dotenv').config();

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
};

// 创建Redis客户端
const client = redis.createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port
  },
  password: redisConfig.password,
  database: redisConfig.db
});

// 错误处理
client.on('error', (err) => {
  console.error('❌ Redis连接错误:', err);
});

client.on('connect', () => {
  console.log('🔗 Redis连接中...');
});

client.on('ready', () => {
  console.log('✅ Redis连接成功');
});

client.on('end', () => {
  console.log('🔌 Redis连接已断开');
});

// 连接Redis
const connectRedis = async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
    return true;
  } catch (error) {
    console.error('❌ Redis连接失败:', error.message);
    return false;
  }
};

// Redis操作封装
const redisOperations = {
  // 确保Redis客户端已连接
  ensureConnection: async () => {
    try {
      if (!client.isOpen) {
        await client.connect();
        console.log('Redis客户端已重新连接');
      }
      return true;
    } catch (error) {
      console.error('Redis连接失败:', error);
      return false;
    }
  },

  // 设置键值对
  set: async (key, value, expireTime = null) => {
    try {
      // 确保连接已建立
      await redisOperations.ensureConnection();
      
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      if (expireTime) {
        await client.setEx(key, expireTime, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis SET错误:', error);
      return false;
    }
  },

  // 获取值
  get: async (key) => {
    try {
      // 确保连接已建立
      await redisOperations.ensureConnection();
      
      const value = await client.get(key);
      
      try {
        // 尝试解析JSON
        return JSON.parse(value);
      } catch (e) {
        // 如果不是JSON，则返回原始值
        return value;
      }
    } catch (error) {
      console.error('Redis GET错误:', error);
      return null;
    }
  },

  // 删除键
  del: async (key) => {
    try {
      // 确保连接已建立
      await redisOperations.ensureConnection();
      
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL错误:', error);
      return false;
    }
  },

  // 检查键是否存在
  exists: async (key) => {
    try {
      // 确保连接已建立
      await redisOperations.ensureConnection();
      
      return await client.exists(key);
    } catch (error) {
      console.error('Redis EXISTS错误:', error);
      return false;
    }
  },

  // 设置过期时间
  expire: async (key, seconds) => {
    try {
      // 确保连接已建立
      await redisOperations.ensureConnection();
      
      await client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE错误:', error);
      return false;
    }
  }
};

// 关闭Redis连接
const closeRedis = async () => {
  try {
    if (client.isOpen) {
      await client.quit();
    }
    return true;
  } catch (error) {
    console.error('❌ Redis关闭失败:', error.message);
    return false;
  }
};

// 导出
module.exports = {
  client,
  connectRedis,
  closeRedis,
  redisOperations
};