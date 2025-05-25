module.exports = {
  apps: [
    {
      name: "next-app",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/root/apps/telegram",
      env: {
        NODE_ENV: "production",
        PORT: 1332
      },
      exec_mode: "fork",
    },
    {
      name: "telegram-server",
      script: "server/telegram-server.js",
      cwd: "/root/apps/telegram",
      env: {
        PORT: 3332,
        NODE_ENV: "production",
      },
    },
  ],
};
