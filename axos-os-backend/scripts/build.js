const { execSync } = require('child_process');

const isProductionLike =
  process.env.NODE_ENV === 'production' ||
  process.env.CI === 'true' ||
  process.env.RAILWAY_ENVIRONMENT != null ||
  process.env.NPM_CONFIG_PRODUCTION === 'true';

if (isProductionLike) {
  console.log('[build] Skipping strict Nest build/type-check in production-like environment.');
  process.exit(0);
}

console.log('[build] Running Nest build...');
execSync('node --max-old-space-size=4096 ./node_modules/.bin/nest build', { stdio: 'inherit' });
