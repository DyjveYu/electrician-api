const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// 导入中间件
const errorHandler = require('./middleware/errorHandler');
const responseFormatter = require('./middleware/responseFormatter');
const rateLimiter = require('./middleware/rateLimiter');

// 路由导入
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
// const reviewRoutes = require('./routes/reviews');
const addressRoutes = require('./routes/addresses');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const systemRoutes = require('./routes/system');
const userRoutes = require('./routes/users');
const electricianRoutes = require('./routes/electricians');
const { initPaymentTimeoutJob } = require('./services/paymentTimeoutJob');

const app = express();
const PORT = process.env.PORT || 3000;

// 如果你部署在阿里云SLB、Nginx等后面，设置为1（或具体IP数量）
app.set('trust proxy', 1);
// 基础中间件
app.use(helmet()); // 安全头
app.use(cors()); // 跨域
app.use(morgan('combined')); // 日志
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 响应格式化中间件
app.use(responseFormatter);

// 限流中间件
// 提高全局限流阈值，避免正常页面加载被误伤
// 说明：默认每分钟10次对于小程序多接口并发较容易触发429，这里提高到100次/分钟。
app.use(rateLimiter({ windowMs: 60 * 1000, max: 100 }));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/users', userRoutes);
app.use('/api/electricians', electricianRoutes);



// 健康检查
app.get('/health', (req, res) => {
  res.success({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.error('接口不存在', 404);
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功，端口: ${PORT}`);
  console.log(`📅 启动时间: ${new Date().toISOString()}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(
    '[Startup] Withdrawal status debug tag: /api/electricians/withdrawals/:outBatchNo/status @',
    new Date().toISOString()
  );
  // 启动预付款超时关闭任务（临时停用以避免启动报错）
  // initPaymentTimeoutJob();
  // 枚举值变更由你手动执行数据库更新，不在应用启动中处理
});

// 消息中心功能已添加

module.exports = app;
