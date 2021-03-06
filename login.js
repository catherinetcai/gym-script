'use strict';

require('dotenv').config();
// Issue running headless Chrome in google cloud functions, following the instructions here:
// https://github.com/puppeteer/puppeteer/issues/3120 to fix
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const yaml = require('js-yaml');
const fs = require('fs');

// Logging stuff
const bunyan = require('bunyan');
const {LoggingBunyan} = require('@google-cloud/logging-bunyan');
const loggingBunyan = new LoggingBunyan();
let streams = [{stream: process.stdout, level: 'info'}];
if (process.env.ENV == "production") {
  streams.push(loggingBunyan.stream('info'));
}

const log = bunyan.createLogger({
  name: 'gym',
  streams: streams,
});

// TODO: Implement overrides
let overrides = null;

try {
  overrides = yaml.safeLoad(fs.readFileSync('./overrides.yml', 'utf8'));
} catch (e) {
  log.warn("Couldn't load an overrides file, proceeding anyway");
}

const entrypoint = async () => {
  const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

  const client = new SecretManagerServiceClient();

  let loginSecret = null;
  if (process.env.ENV == "production") {
    const [secret] = await client.accessSecretVersion({
      name: "projects/621787529314/secrets/gym-scheduler-secret/versions/1",
    });
    loginSecret = secret.payload.data.toString('utf8');
  } else {
    loginSecret = process.env.LOGINS;
  }

  let logins = parseLogins(loginSecret);
  let browser = null;
  try {
    browser = await chromium.puppeteer.launch({
      headless: chromium.headless,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
    });
  } catch(e) {
    log.info("Error opening browser", e);
    exit(1);
  }

  const context = await browser.createIncognitoBrowserContext();
  const promises = []
  logins.forEach(async function(item, _) {
    promises.push(context.newPage().then(async page => {
      await book(page, item[0], item[1]);
    }))
  });
  await Promise.all(promises);
  browser.close();
}

const book = async (page, username, password, overrides) => {
  let logger = log.child({username: username});

  try {
    // const context = await browser.createIncognitoBrowserContext();
    // const page = await context.newPage();

    logger.info("Logging in for: ", username);

    // Login
    await login(page, username, password);

    // Click to book workout
    await page.click('a[href="/myflye/book-workout"]');

    log.info('Page URL after clicking book workout: ', page.url());

    // TODO: This variable is poorly named
    let currentDate = new Date();
    // Travel forward in time so we are incremented an extra day since we're booking for tomorrow
    currentDate.setHours(currentDate.getHours() + 24);

    log.info("Tomorrow's date", currentDate);
    let year = currentDate.getFullYear();
    // Have to add one because month is 0 indexed, because wtf JS
    let month = currentDate.getMonth() + 1;
    let day = currentDate.getDate();

    let workoutURL = `https://myflye.flyefit.ie/myflye/book-workout/167/3/${year}-${month}-${day}`;
    await page.goto(workoutURL);

    // Click to dropdown
    if (isWeekend(currentDate)) {
      logger.info("Booking for the weekend");
      await page.click('*[data-course-time="17:00 - 18:30"]');
    } else {
      logger.info("Booking for the weekday");
      await page.click('*[data-course-time="13:00 - 14:30"]');
    }

    logger.info("Clicked date course time");
    await new Promise(r => setTimeout(r, 500));
    await page.click('#book_class');

    logger.info("Clicked book class");
    return;
  } catch(e) {
    logger.error("Error while booking with browser: ", e);
    return;
  }
};

// Given a page object and credentials, navigate into the login page
const login = async (page, email, password) => {
  await page.goto('https://myflye.flyefit.ie/login');
  await page.type('#email_address', email);
  await page.type('#password', password);
  await page.$eval('form', form => form.submit());
  await page.waitForNavigation();
}

// Returns logins as [[username, password]]
const parseLogins = (loginString) => {
  let logins = loginString.split(",");

  let mapped = logins.map(x => x.split(":"));
  return mapped;
}

const isWeekend = (date) => {
  const day = date.getDay();

  // Saturday = 6, Sunday = 0, both modulo to 0
  return (day % 6 == 0);
}

exports.entrypoint = entrypoint;
exports.parseLogins = parseLogins;
exports.isWeekend = isWeekend;

entrypoint();
