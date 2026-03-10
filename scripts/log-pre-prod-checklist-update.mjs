import fs from 'fs';
import path from 'path';

const checklistPath = path.resolve(process.cwd(), '../pre-prod-checklist-latest.md');
const logPath = path.resolve(process.cwd(), '../pre-prod-checklist-log.json');

function logChecklistUpdate(author = 'auto', status = 'updated') {
  const logEntry = {
    date: new Date().toISOString(),
    author,
    status
  };
  let log = [];
  if (fs.existsSync(logPath)) {
    log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  }
  log.push(logEntry);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}

logChecklistUpdate();
console.log('pre-prod-checklist-latest.md log updated.');