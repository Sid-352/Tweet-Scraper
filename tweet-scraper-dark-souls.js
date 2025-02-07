const puppeteer = require('puppeteer');
const axios = require('axios');
const moment = require('moment');

// Use GitHub secret for Discord Webhook URL
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TWITTER_URL = 'https://twitter.com/darksoulsgame';

// List of hashtags to filter for
const TARGET_HASHTAGS = ['#DarkSoulsRemastered', '#DarkSouls', '#DarkSouls2', '#DarkSouls3'];

async function fetchLatestTweet() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    try {
        await page.goto(TWITTER_URL, { waitUntil: 'networkidle2' });

        // Click "Latest" tab if available (ensures recent tweets are fetched)
        const latestTabSelector = 'a[aria-label="Latest"]';
        if (await page.$(latestTabSelector)) {
            await page.click(latestTabSelector);
            await page.waitForTimeout(3000); // Let page refresh
        }

        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

        // Extra wait time for images and elements to load
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Scrape multiple tweets
        const tweets = await page.evaluate(() => {
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
            const hashtagsToFind = ['#DarkSoulsRemastered', '#DarkSouls', '#DarkSouls2', '#DarkSouls3'];
            let matchingTweet = null;
            let tweetCount = 0;

            for (let tweet of tweetElements) {
                if (tweetCount >= 10) break; // Only check the first 10 tweets (for experimentation)
                tweetCount++;

                const tweetTextElement = tweet.querySelector('div[lang]');
                if (!tweetTextElement) continue;

                const tweetText = tweetTextElement.innerText.trim();

                // Extract the tweet's timestamp (absolute time)
                const timeElement = tweet.querySelector('time');
                const tweetTime = timeElement ? new Date(timeElement.getAttribute('datetime')) : null;
                const now = new Date();

                // Only consider tweets from the last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(now.getDate() - 30);

                if (!tweetTime || tweetTime < thirtyDaysAgo) {
                    continue; // Skip tweets older than 30 days
                }

                // Check if tweet contains any of the specified hashtags
                if (hashtagsToFind.some(tag => tweetText.includes(tag))) {
                    const tweetLink =
                        'https://twitter.com' +
                        tweet.querySelector('a[href*="/status/"]')?.getAttribute('href') ||
                        null;

                    const tweetImages = Array.from(
                        tweet.querySelectorAll('img[src*="pbs.twimg.com/media/"]')
                    ).map(img => img.src);

                    const tweetImage = tweetImages.length > 0 ? tweetImages[0] : null;
                    const profilePic = document.querySelector('img[src*="profile_images"]')?.src || null;

                    matchingTweet = { tweetText, tweetLink, tweetImage, profilePic, tweetTime };
                    break; // Stop searching once we find a match
                }
            }

            return matchingTweet;
        });

        console.log('Extracted Tweet Data:', tweets || 'No matching tweet found.');
        return tweets;
    } catch (error) {
        console.error('Error fetching tweet:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

async function sendToDiscord(tweet) {
    if (!tweet) {
        console.log('No matching tweet found with the specified hashtags.');
        return;
    }

    console.log('Sending Tweet to Discord:', tweet);

    // Format timestamp as ISO (Discord requires this format)
    const formattedDate = moment().toISOString();

    // Create embed object
    const embed = {
        title: 'Dark Souls  •  @DarkSoulsGame',
        description: tweet.tweetText || 'No text available.',
        url: tweet.tweetLink || TWITTER_URL,
        color: 0x1da1f2, // Twitter blue
        footer: { text: 'X' },
        timestamp: formattedDate,
    };

    // Attach main image if available
    if (tweet.tweetImage) {
        embed.image = { url: tweet.tweetImage };
    }

    // Attach profile picture as a thumbnail
    if (tweet.profilePic) {
        embed.thumbnail = { url: tweet.profilePic };
    }

    const payload = { embeds: [embed] };

    try {
        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('Tweet sent to Discord successfully!', response.data);
    } catch (error) {
        console.error('Error sending webhook:', error.response?.data || error.message);
        console.log('Payload Sent:', JSON.stringify(payload, null, 2));
    }
}

// Run the script
(async () => {
    const latestTweet = await fetchLatestTweet();
    await sendToDiscord(latestTweet);
})();
