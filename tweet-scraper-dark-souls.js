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

    // Spoof a user-agent to bypass bot detection
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    );

    try {
        // Navigate to Twitter
        await page.goto(TWITTER_URL, { waitUntil: 'networkidle2' });

        // Wait for tweets to load
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

        // Extra delay to let images load
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Scrape tweet data
        const tweetData = await page.evaluate((TARGET_HASHTAGS) => {
            const tweetElement = document.querySelector('article[data-testid="tweet"]');
            if (!tweetElement) return null;

            const tweetText = tweetElement.querySelector('div[lang]')?.innerText.trim() || 'No text found.';
            const tweetLink =
                'https://twitter.com' +
                tweetElement.querySelector('a[href*="/status/"]')?.getAttribute('href') ||
                null;

            // Get all attached images (ignoring profile pictures)
            const tweetImages = Array.from(
                tweetElement.querySelectorAll('img[src*="pbs.twimg.com/media/"]')
            ).map(img => img.src);

            // Use the first image (or null if none)
            const tweetImage = tweetImages.length > 0 ? tweetImages[0] : null;

            // Get profile picture (thumbnail)
            const profilePic = document.querySelector('img[src*="profile_images"]')?.src || null;

            // Check if tweet contains any of the target hashtags
            const containsHashtag = TARGET_HASHTAGS.some(tag => tweetText.includes(tag));

            return containsHashtag ? { tweetText, tweetLink, tweetImage, profilePic } : null;
        }, TARGET_HASHTAGS);

        console.log('Extracted Tweet Data:', tweetData || 'No matching tweet found.');
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
