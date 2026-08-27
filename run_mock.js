import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 750 });
  
  // Inject mock before scripts load
  await page.evaluateOnNewDocument(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        console.log("Mock invoke:", cmd, args);
        if (cmd === "budget_state") return { month_spent_eur: 12, month_limit_eur: 50, month_pct: 24, today_reports: 2, daily_limit: 10, level: "ok" };
        if (cmd === "api_key_status") return { vorhanden: false };
        if (cmd === "load_profile") return { behandler:{}, praxis:{}, budget:{monthly_eur:50, daily_reports:10}, api:{model:"claude-opus-5"} };
        return null;
      }
    };
  });
  
  // Create a copy of dist/index.html that disables the data-theme check maybe?
  const html = fs.readFileSync('dist/index.html', 'utf8');
  fs.writeFileSync('dist/mock.html', html.replace('<script type="module" crossorigin src="/assets/index', '<script>window.__TAURI_IPC__=()=>Promise.resolve();</script><script type="module" crossorigin src="/assets/index'));
  
  await page.goto('file://' + process.cwd() + '/dist/mock.html');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_actual.png' });
  await browser.close();
})();
