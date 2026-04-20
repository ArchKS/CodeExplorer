import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../src/config.ts');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      if (file.endsWith('.md') || file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

function generateConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    console.log('src/config.ts already exists. Skipping generation.');
    return;
  }

  console.log('Generating src/config.ts...');
  const files = getFiles(PUBLIC_DIR);
  const tagsFound = new Set();
  const tagOrder = [];

  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const tagMatch = content.match(/Tag:\s*(.*)/i);
      if (tagMatch) {
        const tags = tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        tags.forEach(tag => {
          if (!tagsFound.has(tag)) {
            tagsFound.add(tag);
            tagOrder.push(tag);
          }
        });
      }
    } catch (e) {
      // Ignore errors
    }
  });

  const tagSort = {};
  tagOrder.forEach((tag, index) => {
    tagSort[tag] = index + 1;
  });

  const configContent = `export const TAG_SORT: Record<string, number> = ${JSON.stringify(tagSort, null, 2)};\n`;
  fs.writeFileSync(CONFIG_PATH, configContent);
  console.log('src/config.ts generated successfully.');
}

generateConfig();
