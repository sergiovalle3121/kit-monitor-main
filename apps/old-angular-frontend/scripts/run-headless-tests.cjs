#!/usr/bin/env node
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

function resolveChromeBin() {
  const fromEnv = process.env.CHROME_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  try {
    // Optional path when project uses Puppeteer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath?.();
    if (executablePath && existsSync(executablePath)) return executablePath;
  } catch {
    // Puppeteer is optional in this repository.
  }

  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    join(process.env['PROGRAMFILES'] || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

const chromeBin = resolveChromeBin();
if (!chromeBin) {
  console.error(
    [
      '[frontend:test] No Chrome/Chromium executable was found for Karma.',
      'Set CHROME_BIN to a valid browser path, or add puppeteer as a dev dependency to provide one automatically.',
    ].join('\n'),
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const testArgs = ['test', '--watch=false', '--browsers=ChromeHeadlessCI', ...args];

const result = spawnSync('ng', testArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CHROME_BIN: chromeBin,
  },
});

process.exit(result.status ?? 1);
