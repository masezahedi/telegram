module.exports = {
  apps: [
    {
      name: "next-app",
      script: "node_modules/.bin/next",
      args: "start -p 3332",
      env: {
        NODE_ENV: "production",
      },
      exec_mode: "fork",
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
