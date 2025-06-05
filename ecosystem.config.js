module.exports = {
  apps: [
    {
      name: "telegram-service-client",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/root/apps/telegram",
      env: {
        NODE_ENV: "production",
        PORT: 1332,
        NEXT_PUBLIC_API_URL: "https://sna.freebotmoon.ir:3332",
      },
      exec_mode: "fork",
    },
    {
      name: "telegram-service-server",
      script: "server/telegram-server.js",
      cwd: "/root/apps/telegram",
      env: {
        PORT: 3332,
        NODE_ENV: "production",
        HOST: "0.0.0.0",
      },
    },
  ],
};