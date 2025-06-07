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
        BOT_TOKEN: "7592946651:AAF9k8_vdXc2BKMqZZEgK9djE8ef-mjl0PI",
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
