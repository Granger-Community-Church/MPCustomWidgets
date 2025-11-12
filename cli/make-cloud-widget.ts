#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

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

async function main() {
  const folderName = await question('Widget folder name: ');
  
  if (!folderName) {
    console.error('Folder name is required!');
    rl.close();
    process.exit(1);
  }

  const widgetPath = path.join(process.cwd(), 'Widgets', folderName);
  const demoPath = path.join(widgetPath, 'demo.html');

  if (!fs.existsSync(widgetPath)) {
    console.error(`Widget folder not found: ${widgetPath}`);
    rl.close();
    process.exit(1);
  }

  if (!fs.existsSync(demoPath)) {
    console.error(`demo.html not found in: ${widgetPath}`);
    rl.close();
    process.exit(1);
  }

  const repo = 'MinistryPlatform-Community/MPCustomWidgets';
  const branch = getBranch();
  const cdnBase = `https://cdn.jsdelivr.net/gh/${repo}@${branch}`;

  console.log(`\nConverting demo.html to cloud-demo.html for ${folderName}...`);
  console.log(`Using branch: ${branch}\n`);

  let content = fs.readFileSync(demoPath, 'utf-8');

  content = content.replace(
    /href="\/src\/css\/mp-custom\.css"/g,
    `href="${cdnBase}/dist/css/mp-custom.css"`
  );

  content = content.replace(
    /src="\/dist\/js\/customWidgetV1\.js"/g,
    `src="${cdnBase}/dist/js/customWidgetV1.js"`
  );

  content = content.replace(
    /src="\/dist\/js\/forceLogin\.js"/g,
    `src="${cdnBase}/dist/js/forceLogin.js"`
  );

  content = content.replace(
    /data-template="(\/Widgets\/[^"]+)"/g,
    (match, templatePath) => {
      const cloudUrl = `${cdnBase}${templatePath}`;
      return `data-templateUrl="${cloudUrl}"`;
    }
  );

  const cloudDemoPath = path.join(widgetPath, 'cloud-demo.html');
  fs.writeFileSync(cloudDemoPath, content, 'utf-8');

  console.log(`✅ Created: ${cloudDemoPath}`);
  console.log('\nCDN URLs used:');
  console.log(`  CSS: ${cdnBase}/dist/css/mp-custom.css`);
  console.log(`  JS:  ${cdnBase}/dist/js/customWidgetV1.js`);
  console.log(`  Base: ${cdnBase}`);
  
  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
