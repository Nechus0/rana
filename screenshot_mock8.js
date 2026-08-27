import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1400, height: 750 });
  await page1.goto('file://' + process.cwd() + '/mockup8.html');
  await new Promise(r => setTimeout(r, 1000));
  await page1.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_sidebar_improvements.png' });
  await browser.close();
})();
