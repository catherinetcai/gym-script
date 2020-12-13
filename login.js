'use strict';

require('dotenv').config();
const puppeteer = require('puppeteer');
const bunyan = require('bunyan');
const {LoggingBunyan} = require('@google-cloud/logging-bunyan');
const loggingBunyan = new LoggingBunyan();
const log = bunyan.createLogger({
  name: 'gym',
  streams: [
    // Log to the console at 'info' and above
    {stream: process.stdout, level: 'info'},
    // And log to Stackdriver Logging, logging at 'info' and above
    loggingBunyan.stream('info'),
  ],
});

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

  logins.forEach(async function(item, _) {
    await book(item[0], item[1]);
  });
}

const book = async (username, password) => {
  const browser = await puppeteer.launch();
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();

  log.info("Logging in for: ", username);

  // Login
  await login(page, username, password);

  // Click to book workout
  await page.click('a[href="/myflye/book-workout"]');

  log.info('Page URL after clicking book workout: ', page.url());

  let currentDate = new Date();
  // Travel forward in time so we are incremented an extra day since we're booking for tomorrow
  currentDate.setHours(currentDate.getHours() + 24);

  log.info("Tomorrow's date", currentDate);
  let year = currentDate.getFullYear();
  // Have to add one because month is 0 indexed lmao
  let month = currentDate.getMonth()+1;
  let day = currentDate.getDate();

  let workoutURL = `https://myflye.flyefit.ie/myflye/book-workout/167/3/${year}-${month}-${day}`;
  await page.goto(workoutURL);

  // Click to dropdown
  if (isWeekend(currentDate)) {
    log.info("Booking for the weekend");
    await page.click('*[data-course-time="17:00 - 18:15"]');
  } else {
    log.info("Booking for the weekday");
    await page.click('*[data-course-time="13:00 - 14:15"]');
  }

  log.info("Clicked date course time");
  await new Promise(r => setTimeout(r, 500));
  await page.click('#book_class');

  log.info("Clicked book class");
  browser.close();
};

// Given a page object and credentials, navigate into the login page
const login = async (page, email, password) => {
  await page.goto('https://myflye.flyefit.ie/login');
  await page.type('#email_address', email);
  await page.type('#password', password);
  await page.click('.btn[name="log_in"]');
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
  if (day % 6 == 0) {
    return true;
  }

  return false;
}

exports.entrypoint = entrypoint;
exports.parseLogins = parseLogins;
exports.isWeekend = isWeekend;

entrypoint();
