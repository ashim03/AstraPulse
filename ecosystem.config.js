module.exports = {
  apps: [
    {
      name: "hikvision-poller",
      script: "device-poller.js",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
      },
      // Restart on crash
      exp_backoff_restart_delay: 1000,
      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/poller-error.log",
      out_file: "logs/poller-out.log",
      merge_logs: true,
    },
  ],
};
