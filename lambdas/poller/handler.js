// const AWS = require('aws-sdk');
// const S3 = new AWS.S3();

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const { TWITCH_CLIENT_ID } = process.env;

// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://aws.amazon.com/developers/getting-started/nodejs/

// Load the AWS SDK
const AWS = require('aws-sdk');

const region = 'us-east-1';
const secretName = 'TWITCH_CLIENT_SECRET';
// Create a Secrets Manager client
const client = new AWS.SecretsManager({
  region,
});


// console.log(SecretString);

const mock = {
  timestamp: 1615854639484,
  plan: 'none',
  twitch_username: 'tickingaway21',
  twitch_id: '83093651',
  twitch_profile_picture:
    'https://static-cdn.jtvnw.net/jtv_user_pictures/tickingaway21-profile_image-fcffb5f3047f9b77-300x300.jpeg',
  stripeCustomerID: 'cus_J7gAUKPKBBYy11',
  isMonitoring: true,
  username: 'tickingaway21',
};

const getUsersToPoll = async () => {
  try {
    const db = await connectToDatabase();
    const usersToMonitor = await db
      .collection('users')
      .find({
        isMonitoring: true,
      })
      .project({ twitch_id: 1 })
      .toArray();
    return usersToMonitor;
  } catch (e) {
    console.error(e);
    return e;
  }
};

const checkS3forMessages = async () => {
  // const { Body } = await S3.getObject({ Bucket: name, Key: key }).promise();
};

const getVodsToDownload = async () => {
  try {
    const usersToPoll = await getUsersToPoll();
    const appToken = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${appToken}`,
      'Client-ID': TWITCH_CLIENT_ID,
    };

    const videoIds = [];
    // aggregates response from Twitch API containing details of last VOD for each user
    // https://dev.twitch.tv/docs/api/reference#get-videos
    const videoPromises = usersToPoll.map(async ({ twitch_id: twitchId }) => {
      const url = `https://api.twitch.tv/helix/videos?user_id=${twitchId}&type=archive&first=3`;
      const resp = await fetch(url, { headers });
      const singleStreamersVideos = await resp.json();
      singleStreamersVideos.data.forEach(({ id }) => {
        videoIds.push(id);
      });
      return singleStreamersVideos;
    });

    Promise.all(videoPromises);
    return checkS3forMessages(videoIds);
  } catch (err) {
    console.err(err);
    return err;
  }
};

exports.main = async (event) => {
  try {
    const { SecretString } = await client.getSecretValue({ SecretId: secretName }).promise();
    
    return SecretString
  } catch (error) {
    const body = error.stack || JSON.stringify(error, null, 2);
    return body;
  }
};
