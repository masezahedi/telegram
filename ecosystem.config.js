module.exports = {
  apps: [
    {
      name: "next-app",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3332",
      cwd: "/root/apps/telegram",
      env: {
        NODE_ENV: "production",
      },
      exec_mode: "fork",
    },
    {
      name: "telegram-server",
      script: "server/telegram-server.js",
      cwd: "/root/apps/telegram",
      env: {
        PORT: 1332,
        NODE_ENV: "production",
      },
    },
  ],
};
