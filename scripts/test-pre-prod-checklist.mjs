import assert from 'assert';
import fs from 'fs';
import path from 'path';

const checklistPath = path.resolve(process.cwd(), '../pre-prod-checklist-latest.md');

// Unit test: файл должен существовать и содержать сегодняшнюю дату
const today = new Date().toISOString().split('T')[0];
const content = fs.readFileSync(checklistPath, 'utf8');
assert(content.includes(today), 'Checklist does not contain today date');
console.log('Checklist unit test passed.');