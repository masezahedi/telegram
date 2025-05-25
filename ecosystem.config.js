module.exports = {
  apps: [
    {
      name: "next-app",
      script: "npm",
      args: "start",
      env: {
        PORT: 3332,
        NODE_ENV: "production",
      },
    },
    {
      name: "telegram-server",
      script: "server/telegram-server.js",
      env: {
        PORT: 1332,
        NODE_ENV: "production",
      },
    },
  ],
};
