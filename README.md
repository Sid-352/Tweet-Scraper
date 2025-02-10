# Tweet-Scraper
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)

## Overview
Tweet-Scraper is a Node.js application designed to scrape the latest tweet from the `@DarkSoulsgame` Twitter handle and send it to a specified Discord webhook as an embed message.

## Features
- Scrapes the latest tweet from the `@DarkSoulsgame` Twitter handle.
- Sends the tweet to a configured Discord webhook.
- Automatically attaches images and profile pictures to the Discord embed alongside addtional information in the Footer.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Sid-352/Dark-Souls-Tweet-scraper.git
   cd Dark-Souls-Tweet-scraper
   ```

2. Install the required dependencies:
   ```bash
   npm install
   ```

## Configuration
Set up your environment variables by creating a ``.env`` file in the root directory and adding your Discord webhook URL:
   ```env
   DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL
   ```

## Usage
Run the script to start scraping the latest tweet and sending it to the Discord webhook:
  ```bash
  node tweet_scraper.js
  ```

## Using the code with another handle
If you want to use the code with another twitter handle (e.g. ``@ELDENRING``), you need to modify the code to some degree. Replace the Twitter Handle on ``line 7`` of the code with one of your choosing, or the code can be modified to take an input from the user.

The difficult part comes with Twitter usernames, a pre-defined name was used in this code on ``line 89``, which can be replaced with a generic title, or if possible a block of code to efficiently extract the Twitter username.

## GitHub Actions
There is also a manual GitHub Action setup to run the script.

### Create or modify the existing Workflow
The workflow file is located at ```.github/workflows/tweet_scraper.yml``` which can accessed by clicking [here](.github/workflows/manual_tweet_scraper.yml).

### Running the Workflow
Go in Actions Tab, In the Actions sidebar find the correct workflow name, ``Fetch Latest Tweet from @DarkSoulsGame`` in this case, click on it and then click on the ``Run Workflow`` option. 

### Automatic Scheduled Script
The New Script located in ``/Scheduled Scraper`` folder is able to automatically extract and post the tweets every 12 hours via a cron job defined in this file [here](.github/workflows/scheduled_tweet_scraper.yml). It also has an additional feature, it is able to ignore repeated tweets and keeps rechecking after every 12 hours until a new tweet is found after comparison. 

For more additions, you can modify the script to clear the old logs every 30 days, but because the handle im targetting is very infrequent in posting such information, I do not have a requirement to do so.
