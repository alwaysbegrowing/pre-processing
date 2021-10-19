const fetch = require('node-fetch');
const { SecretsManager } = require('aws-sdk');

const { TWITCH_CLIENT_SECRET_ARN, TWITCH_CLIENT_ID } = process.env;
let cachedTwitchSecret;
let cachedAccessToken;

/**
 * isAccessTokenValid() validates cachedAccessToken
 * @returns bool representing validity of current access token
 * reference documentation: https://dev.twitch.tv/docs/authentication#validating-requests
 */
async function isAccessTokenValid(token) {
  const url = 'https://id.twitch.tv/oauth2/validate';
  const isValid = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `OAuth ${token}`,
    },
  });
  return isValid.ok;
}

/**
 * This function performs the necessary handling to return a valid access token
 * @returns app access token
 */
async function getAccessToken() {
  console.info('getting access token');
  if (cachedAccessToken) {
    const isValid = await isAccessTokenValid(cachedAccessToken);
    console.info('is cached access token valid?', { isValid });

    if (isValid) {
      return cachedAccessToken;
    }
  }
  const client = new SecretsManager();
  const { SecretString } = await client
    .getSecretValue({ SecretId: TWITCH_CLIENT_SECRET_ARN })
    .promise();
  cachedTwitchSecret = SecretString;
  const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${cachedTwitchSecret}&grant_type=client_credentials`;

  // get a new app access token from twitch
  const tokenData = await fetch(url, {
    method: 'POST',
  });
  const resp = await tokenData.json();
  cachedAccessToken = resp.access_token;
  return resp.access_token;
}

exports.getAccessToken = getAccessToken;
