#!/usr/bin/env tsx

import { execSync } from 'child_process';

function getBranch(): string {
  try {
    const defaultBranch = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf-8' })
      .trim()
      .replace('refs/remotes/origin/', '');
    return defaultBranch;
  } catch {
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
      return currentBranch === 'HEAD' ? 'main' : currentBranch;
    } catch {
      return 'main';
    }
  }
}

function main() {
  const repo = 'MinistryPlatform-Community/MPCustomWidgets';
  const branch = getBranch();
  const jsFile = 'dist/js/customWidgetV1.js';
  const cssFile = 'dist/css/mp-custom.css';
  
  console.log('\n📦 CDN URLs for MPCustomWidgets:\n');
  console.log(`JavaScript:`);
  console.log(`https://cdn.jsdelivr.net/gh/${repo}@${branch}/${jsFile}\n`);
  console.log(`CSS:`);
  console.log(`https://cdn.jsdelivr.net/gh/${repo}@${branch}/${cssFile}\n`);
  console.log(`Branch: ${branch}`);
}

main();
