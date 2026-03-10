// Скрипт для генерации и автоматической перезаписи pre-prod-checklist-latest.md
import fs from 'fs';
import path from 'path';

const checklistTemplate = `# Pre-Prod Checklist (latest)

Дата генерации: ${new Date().toISOString().split('T')[0]}

- [ ] Проверка релизных артефактов
- [ ] Проверка блокирующих ошибок
- [ ] Проверка SEO
- [ ] Проверка интеграций
- [ ] Проверка платежей
- [ ] Проверка UI/UX
- [ ] Проверка логирования
- [ ] Проверка мониторинга
- [ ] Проверка документации
- [ ] Финальное подтверждение релиза
`;

const checklistPath = path.resolve(process.cwd(), '../pre-prod-checklist-latest.md');
fs.writeFileSync(checklistPath, checklistTemplate);
console.log(`pre-prod-checklist-latest.md успешно обновлен: ${checklistPath}`);