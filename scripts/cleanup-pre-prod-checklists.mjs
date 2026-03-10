import fs from 'fs';
import path from 'path';

const checklistDir = path.resolve(process.cwd(), '../');
const files = fs.readdirSync(checklistDir);
const checklistFiles = files.filter(f => /^pre-prod-checklist-\d{4}-\d{2}-\d{2}\.md$/.test(f));

// Оставить только последние 3, остальные удалить
const sorted = checklistFiles.sort().reverse();
const toDelete = sorted.slice(3);
toDelete.forEach(f => {
  fs.unlinkSync(path.join(checklistDir, f));
});

console.log('Старые pre-prod-checklist-*.md очищены, оставлены только последние 3.');