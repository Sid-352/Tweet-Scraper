const puppeteer = require('puppeteer');
const axios = require('axios');
const moment = require('moment'); // Import moment.js for formatting

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1336707950831472693/QbTu1wTQP0oRbKSJl86AkuPZ3pyHxYKGEhOd9K08eciLs4oIi4KdAFSpJEptFVqKr4mr'; 
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || 'darksoulsgame'; // Use env variable for custom handle
const TWITTER_URL = `https://twitter.com/${TWITTER_HANDLE}`;

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

        // Wait for the first tweet to load
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

        // Manual delay to let images load properly
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Scrape tweet data
        const tweetData = await page.evaluate(() => {
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

            return { tweetText, tweetLink, tweetImage, profilePic };
        });

        console.log('Extracted Tweet Data:', tweetData); // Debugging Output
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

    console.log('Sending Tweet to Discord:', tweet); // Debugging Output

    // Format timestamp as ISO (Discord requires this format)
    const formattedDate = moment().toISOString();

    // Create embed object correctly
    const embed = {
        title: `${TWITTER_HANDLE}  •  @${TWITTER_HANDLE}`, // Dynamic title
        description: tweet.tweetText || 'No text available.',
        url: tweet.tweetLink || TWITTER_URL,
        color: 0x1da1f2, // Twitter blue
        footer: {
            text: 'X', // Updated footer from "Twitter Scraper Bot" to "X"
        },
        timestamp: formattedDate, // ISO format timestamp
    };

    // Attach main image if available
    if (tweet.tweetImage) {
        embed.image = { url: tweet.tweetImage };
    }

    // Attach profile picture as a thumbnail
    if (tweet.profilePic) {
        embed.thumbnail = { url: tweet.profilePic };
    }

    // Ensure Discord API accepts the payload
    const payload = { embeds: [embed] };

    try {
        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('Tweet sent to Discord successfully!', response.data);
    } catch (error) {
        console.error('Error sending webhook:', error.response?.data || error.message);
        console.log('Payload Sent:', JSON.stringify(payload, null, 2)); // Log payload for debugging
    }
}

// Run the script
(async () => {
    const latestTweet = await fetchLatestTweet();
    await sendToDiscord(latestTweet);
})();
