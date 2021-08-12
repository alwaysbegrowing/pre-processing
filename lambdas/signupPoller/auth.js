const fetch = require('node-fetch');
const { SecretsManager } = require('aws-sdk');

const secretName = 'TWITCH_CLIENT_SECRET';
let cachedTwitchSecret;
let cachedAccessToken;

/**
 * isAccessTokenValid() validates cachedAccessToken
 * @returns bool representing validity of current access token
 * reference documentation: https://dev.twitch.tv/docs/authentication#validating-requests
 */
async function isAccessTokenValid() {
  const url = 'https://id.twitch.tv/oauth2/validate';
  const isValid = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `OAuth ${cachedAccessToken}`,
    },
  });
  return isValid.ok;
}

/**
 * This function performs the necessary handling to return a valid access token
 * @returns app access token
 */
async function getAccessToken() {
  if (cachedAccessToken) {
    const isValid = await isAccessTokenValid();
    if (isValid) {
      return cachedAccessToken;
    }
  }
  if (!cachedTwitchSecret) {
    const client = new SecretsManager();
    const { SecretString } = await client.getSecretValue({ SecretId: secretName }).promise();
    cachedTwitchSecret = SecretString;
  }

  const url = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${cachedTwitchSecret}&grant_type=client_credentials`;
  try {
    // get a new app access token from twitch
    const tokenData = await fetch(url, {
      method: 'POST',
    });
    const resp = await tokenData.json();
    cachedAccessToken = resp.access_token;
    return resp.access_token;
  } catch (e) {
    console.error(e);
    return null;
  }
}

exports.getAccessToken = getAccessToken;
