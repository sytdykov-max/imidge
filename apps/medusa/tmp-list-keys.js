const { MedusaApp } = require('@medusajs/framework');
(async()=>{
  const app = await MedusaApp({
    cwd: process.cwd(),
    skipMigrations: true,
  });
  const container = app.container;
  const service = container.resolve('api_key');
  const keys = await service.listApiKeys({ type: 'publishable' }, { take: 5 });
  console.log('keys', keys.length);
  for (const k of keys) console.log(k.title, k.token || k.id);
  await app.shutdown();
})().catch(async (e)=>{ console.error(e); process.exit(1); });
