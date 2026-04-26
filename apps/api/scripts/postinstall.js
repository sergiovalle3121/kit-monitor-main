const { execSync } = require('child_process');

const isProduction = process.env.NODE_ENV === 'production' || process.env.NPM_CONFIG_PRODUCTION === 'true';

if (isProduction) {
  console.log('[postinstall] Skipping Nest build in production environment.');
  process.exit(0);
}

console.log('[postinstall] Running Nest build...');
execSync('npx nest build', { stdio: 'inherit' });
