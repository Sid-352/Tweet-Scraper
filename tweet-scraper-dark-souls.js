const puppeteer = require('puppeteer');
const axios = require('axios');
const moment = require('moment');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TWITTER_URL = 'https://twitter.com/darksoulsgame';

async function fetchLatestTweet() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    try {
        await page.goto(TWITTER_URL, { waitUntil: 'networkidle2' });

        // Ensure we are on the "Latest" tab
        const latestTabSelector = 'a[aria-label="Latest"]';
        if (await page.$(latestTabSelector)) {
            await page.click(latestTabSelector);
            await page.waitForTimeout(5000); // Wait for page refresh
        }

        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

        // Scroll multiple times to load more tweets
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(3000);
        }

        // Extra wait for images and elements to fully load
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Scrape all tweets
        const tweetData = await page.evaluate(() => {
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
            const hashtagsToFind = ['#DarkSoulsRemastered', '#DarkSouls', '#DarkSouls2', '#DarkSouls3'];
            let matchingTweet = null;

            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            for (let tweet of tweetElements) {
                const tweetText = tweet.querySelector('div[lang]')?.innerText.trim() || '';
                const tweetLink = 'https://twitter.com' + (tweet.querySelector('a[href*="/status/"]')?.getAttribute('href') || '');
                
                // Extract timestamp
                const timeElement = tweet.querySelector('time');
                if (!timeElement) continue;

                const tweetDate = new Date(timeElement.getAttribute('datetime'));
                if (tweetDate < thirtyDaysAgo) continue; // Skip old tweets

                // Check if tweet contains any of the hashtags
                if (hashtagsToFind.some(tag => tweetText.includes(tag))) {
                    const tweetImages = Array.from(tweet.querySelectorAll('img[src*="pbs.twimg.com/media/"]'))
                        .map(img => img.src);
                    const tweetImage = tweetImages.length > 0 ? tweetImages[0] : null;
                    const profilePic = document.querySelector('img[src*="profile_images"]')?.src || null;

                    matchingTweet = { tweetText, tweetLink, tweetImage, profilePic };
                    break; // Stop after finding the first valid tweet
                }
            }

            return matchingTweet;
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
        console.log('No matching tweet found.');
        return;
    }

    console.log('Sending Tweet to Discord:', tweet);

    const formattedDate = moment().toISOString();

    const embed = {
        title: 'Dark Souls  •  @DarkSoulsGame',
        description: tweet.tweetText || 'No text available.',
        url: tweet.tweetLink || TWITTER_URL,
        color: 0x1da1f2,
        footer: { text: 'X' },
        timestamp: formattedDate,
    };

    if (tweet.tweetImage) {
        embed.image = { url: tweet.tweetImage };
    }
    if (tweet.profilePic) {
        embed.thumbnail = { url: tweet.profilePic };
    }

    const payload = { embeds: [embed] };

    try {
        await axios.post(WEBHOOK_URL, payload, { headers: { 'Content-Type': 'application/json' } });
        console.log('Tweet sent to Discord successfully!');
    } catch (error) {
        console.error('Error sending webhook:', error.response?.data || error.message);
    }
}

// Run the script
(async () => {
    const latestTweet = await fetchLatestTweet();
    await sendToDiscord(latestTweet);
})();
