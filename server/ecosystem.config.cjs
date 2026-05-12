// pm2 process manifest.
//
// Cluster mode + 2 instances gives us hot failover: if one worker crashes, pm2
// respawns it while the other keeps serving requests. The Node server is fully
// stateless (JWTs are HMAC-verified per-request, no in-memory sessions), so
// cluster mode is safe.
//
// Start:   pm2 start ecosystem.config.cjs --env production
// Reload:  pm2 reload ecosystem.config.cjs --env production    (zero-downtime)
// Status:  pm2 status
// Logs:    pm2 logs initech-backend

module.exports = {
  apps: [
    {
      name: 'initech-backend',
      script: 'dist/index.js',
      cwd: __dirname,
      exec_mode: 'cluster',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      // Crash-loop protection: pm2 gives up after `max_restarts` retries unless
      // `min_uptime` has elapsed since the last successful boot.
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      kill_timeout: 10_000, // matches the 10s grace inside src/index.ts
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001,
      },
      // Logs go to /var/log/pm2/* by default; tweak here if needed.
      out_file: '/var/log/pm2/initech-backend.out.log',
      error_file: '/var/log/pm2/initech-backend.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
