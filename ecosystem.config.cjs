module.exports = {
  apps: [
    {
      name: "travellingbuddy",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/travelling-buddy",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/travelling-buddy/error.log",
      out_file: "/var/log/travelling-buddy/out.log",
      merge_logs: true,
      autorestart: true,
      watch: false,
    },
  ],
};
