import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  
  // Expanded: use 1400px width so media query max-width:1240px doesn't hide right panel!
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1400, height: 750 });
  await page1.goto('file://' + process.cwd() + '/mockup7_expanded.html');
  await new Promise(r => setTimeout(r, 1000));
  await page1.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_expanded.png' });
  
  // Collapsed: both sidebars collapsed
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1400, height: 750 });
  await page2.goto('file://' + process.cwd() + '/mockup7_collapsed.html');
  await new Promise(r => setTimeout(r, 1000));
  await page2.screenshot({ path: '/Users/joschapocha/.gemini/antigravity/brain/0e4bf4c8-d7b0-4db5-95d9-c1eceb2cc794/rana_collapsed.png' });
  
  await browser.close();
})();
