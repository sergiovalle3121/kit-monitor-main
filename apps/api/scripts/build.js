const { execSync } = require('child_process');

console.log('[build] Running Nest build with increased memory...');
execSync('NODE_OPTIONS="--max-old-space-size=4096" npx nest build', { stdio: 'inherit' });
