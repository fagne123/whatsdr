module.exports = {
  apps: [{
    name: 'ligai',
    script: 'index.js',
    cwd: '/root/ligai',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
