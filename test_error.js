const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    await page.goto('http://localhost:1420', { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Check if there is an error overlay
    const overlay = await page.evaluate(() => {
        return document.querySelector('vite-error-overlay') ? 'Vite Error Overlay Present' : null;
    });
    if (overlay) console.log(overlay);
    
    // We can also click the cost tab to trigger the error if it hasn't crashed yet
    // Wait for the cost view button
    try {
        await page.waitForSelector('button', { timeout: 2000 });
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const costBtn = btns.find(b => b.textContent && b.textContent.includes('Cost Estimate'));
            if (costBtn) costBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
        console.log('Error clicking cost button:', e.message);
    }
    
  } catch (error) {
    console.log('Navigation error:', error.message);
  } finally {
    await browser.close();
  }
})();
