/* eslint-disable no-console */
import { ObjectId } from 'mongodb';

const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const { TWITCH_CLIENT_ID, REFRESH_VOD_TOPIC } = process.env;

const VOD_LIMIT = 5;

const sendRefreshVodSns = async (vodsToRefresh) => {
  console.log({ vodsToRefresh });
  const SnsTopicsSent = vodsToRefresh.map(async (vodToRefresh) => {
    const params = {
      Message: 'Request to Refresh Data',
      TopicArn: REFRESH_VOD_TOPIC,
      MessageAttributes: {
        VideoId: {
          DataType: 'String',
          StringValue: vodToRefresh,
        },
      },
    };

    const publishTextPromise = await new AWS.SNS().publish(params).promise();
    return publishTextPromise;
  });
  return Promise.all(SnsTopicsSent);
};

// main handler
exports.handler = async (event) => {
  // get user id from sns event attribute
  // eslint-disable-next-line no-underscore-dangle
  const userId = event.Records[0].Sns.MessageAttributes._id.Value;

  // connect to database
  const db = await connectToDatabase();

  // get user from database
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

  // get twitch ID from user
  const twitchId = user.twitch_id;

  // get twitch access token
  const accessToken = await getAccessToken();

  // construct twitch headers
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-ID': TWITCH_CLIENT_ID,
  };

  // construct url to get user's last 5 vods
  const url = `'https://api.twitch.tv/helix/videos?user_id=${twitchId}&limit=${VOD_LIMIT}&type=archive`;

  // fetch url
  const response = await fetch(url, { headers });

  // get data from json body
  const { data } = await response.json();

  let videoIds = [];

  // get all vod ids from response
  if (response.ok) {
    videoIds = data.map(({ id }) => id);
  }

  // send refresh vod sns
  const refreshVodResponse = await sendRefreshVodSns(videoIds);
  const resp = { videoIds, refreshVodResponse };

  console.log(resp);
  return resp;
};
