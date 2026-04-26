const { execSync } = require('child_process');

console.log('[build] Running Nest build...');
execSync('node --max-old-space-size=4096 ./node_modules/.bin/nest build', { stdio: 'inherit' });
