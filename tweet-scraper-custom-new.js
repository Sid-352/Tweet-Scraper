const puppeteer = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const moment = require('moment');

puppeteer.use(stealthPlugin());

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || 'boblord14w';
const TWITTER_URL = `https://x.com/${TWITTER_HANDLE}`;

async function fetchLatestTweet() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    try {
        await page.goto(TWITTER_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForTimeout(5000); // Extra wait for stability
        await page.waitForSelector('div[data-testid="UserName"] span', { timeout: 60000 });

        const tweetData = await page.evaluate(() => {
            // ✅ **Improved Display Name Selector**
            const displayNameElement = document.querySelector('div[data-testid="UserName"] span:first-of-type');
            const displayName = displayNameElement ? displayNameElement.innerText.trim() : null;

            return { displayName };
        });

        console.log('Extracted Tweet Data:', tweetData);
        return tweetData;
    } catch (error) {
        console.error('Error fetching tweet:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

(async () => {
    const latestTweet = await fetchLatestTweet();
    console.log(latestTweet);
})();

