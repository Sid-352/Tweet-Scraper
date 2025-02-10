const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const moment = require('moment');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TWITTER_URL = 'https://twitter.com/darksoulsgame';
const LAST_TWEET_FILE = 'last_tweet.txt';

async function fetchLatestTweet() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');

    try {
        await page.goto(TWITTER_URL, { waitUntil: 'networkidle2' });
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const tweetData = await page.evaluate(() => {
            const tweetElement = document.querySelector('article[data-testid="tweet"]');
            if (!tweetElement) return null;
            
            const tweetText = tweetElement.querySelector('div[lang]')?.innerText.trim() || 'No text found.';
            const tweetLink = 'https://twitter.com' + tweetElement.querySelector('a[href*="/status/"]')?.getAttribute('href') || null;
            
            return { tweetText, tweetLink };
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

async function sendToDiscord(tweet) {
    if (!tweet) {
        console.log('No tweet found.');
        return;
    }
    
    let lastTweet = '';
    if (fs.existsSync(LAST_TWEET_FILE)) {
        lastTweet = fs.readFileSync(LAST_TWEET_FILE, 'utf8').trim();
    }
    
    if (tweet.tweetText === lastTweet) {
        console.log('No new tweet found.');
        return;
    }

    fs.writeFileSync(LAST_TWEET_FILE, tweet.tweetText);
    console.log('New tweet detected, sending to Discord...');

    const embed = {
        title: 'Dark Souls  •  @DarkSoulsGame',
        description: tweet.tweetText,
        url: tweet.tweetLink || TWITTER_URL,
        color: 0x1da1f2,
        footer: { text: 'X' },
        timestamp: moment().toISOString(),
    };

    const payload = { embeds: [embed] };
    
    try {
        await axios.post(WEBHOOK_URL, payload, { headers: { 'Content-Type': 'application/json' } });
        console.log('Tweet sent to Discord successfully!');
    } catch (error) {
        console.error('Error sending webhook:', error.response?.data || error.message);
    }
}

(async () => {
    const latestTweet = await fetchLatestTweet();
    await sendToDiscord(latestTweet);
})();
