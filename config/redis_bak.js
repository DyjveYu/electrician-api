
/**
 * ⚠️ 此文件已废弃
 * 2025年10月9日 起
 * 请使用 src/config/redis.js 
 * 
 * 
 * 此文件保留用于兼容性，将在下个版本删除
 */

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
      if (!value) return null;
      
      // 尝试解析JSON
      try {
        return JSON.parse(value);
      } catch {
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
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS错误:', error);
      return false;
    }
  },

  // 设置过期时间
  expire: async (key, seconds) => {
    try {
      await client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE错误:', error);
      return false;
    }
  },

  // 获取剩余过期时间
  ttl: async (key) => {
    try {
      return await client.ttl(key);
    } catch (error) {
      console.error('Redis TTL错误:', error);
      return -1;
    }
  },

  // 哈希操作
  hset: async (key, field, value) => {
    try {
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      await client.hSet(key, field, value);
      return true;
    } catch (error) {
      console.error('Redis HSET错误:', error);
      return false;
    }
  },

  hget: async (key, field) => {
    try {
      const value = await client.hGet(key, field);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error('Redis HGET错误:', error);
      return null;
    }
  },

  // 列表操作
  lpush: async (key, value) => {
    try {
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      await client.lPush(key, value);
      return true;
    } catch (error) {
      console.error('Redis LPUSH错误:', error);
      return false;
    }
  },

  rpop: async (key) => {
    try {
      const value = await client.rPop(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error('Redis RPOP错误:', error);
      return null;
    }
  }
};

// 关闭连接
const closeRedis = async () => {
  try {
    await client.quit();
    console.log('Redis连接已关闭');
  } catch (error) {
    console.error('关闭Redis连接错误:', error);
  }
};

module.exports = {
  client,
  connectRedis,
  closeRedis,
  redisOperations
};