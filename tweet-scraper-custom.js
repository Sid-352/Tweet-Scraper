const puppeteer = require('puppeteer');
const axios = require('axios');
const moment = require('moment'); // Import moment.js for formatting

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1335506156344446996/pMdyxSkm8YJsIOdvW1xwcv_habMu09G1LlnKd35I9GaKZrHtrYwZMWuhyWJtTbtkt-Ud';  
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

        // Wait for the profile data to load (to get the display name)
        await page.waitForSelector('div[data-testid="UserProfileHeader_Items"]', { timeout: 10000 });

        // Extract display name and handle
        const userData = await page.evaluate(() => {
            const displayName = document.querySelector('div[data-testid="UserProfileHeader_Items"] span')?.innerText || 'Unknown User';
            const handle = document.querySelector('div[data-testid="UserProfileHeader_Items"] span[class*="username"]')?.innerText || 'No handle';
            return { displayName, handle };
        });

        // Wait for the first tweet to load
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

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
        return { tweetData, userData };
    } catch (error) {
        console.error('Error fetching tweet:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

async function sendToDiscord(tweet, userData) {
    if (!tweet) {
        console.log('No tweet found.');
        return;
    }

    console.log('Sending Tweet to Discord:', tweet);

    // Format timestamp as ISO (Discord requires this format)
    const formattedDate = moment().toISOString();

    // Debugging: Log image URLs to check if they are correct
    console.log("Tweet Image URL:", tweet.tweetImage);
    console.log("Profile Picture URL:", tweet.profilePic);

    // Create embed object
    const embed = {
        title: `${userData.displayName}  •  @${userData.handle}`, // Use the display name and handle dynamically
        description: tweet.tweetText || 'No text available.',
        url: tweet.tweetLink || TWITTER_URL,
        color: 0x1da1f2,
        footer: {
            text: 'X',
        },
        timestamp: formattedDate,
    };

    // Attach tweet image if available
    if (tweet.tweetImage) {
        embed.image = { url: tweet.tweetImage };
    }

    // Attach profile picture as a thumbnail if available
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
    const { tweetData, userData } = await fetchLatestTweet();
    await sendToDiscord(tweetData, userData);
})();
