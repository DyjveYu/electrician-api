module.exports = {
  apps: [
    {
      name: "electrician-api",
      script: "src/app.js",
      cwd: "/www/wwwroot/electrician-api",   // ← 必须写你项目的根路径
      env: {
        NODE_ENV: "development", // 测试环境 development |生产 production
      }
    }
  ]
};
