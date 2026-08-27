import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.evaluateOnNewDocument(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === 'is_configured') return true;
        if (cmd === 'get_profile') return {
          praxis: { name: 'Praxis Dr. Rana' }, behandler: { name: 'Dr. Rana' },
          verfahren: { art: 'vt', setting: 'einzel', qualifikation: 'aerztlich' }, layout: {},
          api: { model: 'Opus' }, budget: { monthly_eur: 50, daily_reports: 10 },
          eingerichtet: true
        };
        if (cmd === 'list_patients') return [
          { id: '1', label: 'Max Mustermann', chiffre: 'M.M.', report_count: 2 }
        ];
        if (cmd === 'list_cases') return [];
        if (cmd === 'budget_state') return {
          month_spent_eur: 12.50, month_limit_eur: 50, month_pct: 25,
          today_reports: 2, daily_limit: 10, level: 'ok', may_send: true
        };
        if (cmd === 'api_key_status') return { vorhanden: true, maskiert: '***ABC' };
        if (cmd === 'merge_pending') return 0;
        return null;
      }
    };
  });
  
  await page.goto('http://localhost:8080/');
  
  try {
    await page.waitForSelector('.topbar', { timeout: 3000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_topbar.png' });
    
    await page.click('#btnRailToggle');
    await page.click('#btnCtxToggle');
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_collapsed.png' });
    
  } catch(e) {
    console.error('Test failed', e);
  }
  await browser.close();
})();
