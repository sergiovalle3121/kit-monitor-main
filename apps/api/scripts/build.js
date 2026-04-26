const { execSync } = require('child_process');

console.log('[build] Running Nest build...');
execSync('npx nest build', { stdio: 'inherit' });
