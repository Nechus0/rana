import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 750 });
  await page.goto('file://' + process.cwd() + '/mockup5.html');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_final_light.png' });
  await browser.close();
})();
