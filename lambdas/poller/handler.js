// const AWS = require('aws-sdk');
// const S3 = new AWS.S3();
const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const S3 = new AWS.S3();

const { TWITCH_CLIENT_ID, TOPIC, BUCKET } = process.env;

const getUsersToPoll = async () => {
  try {
    const db = await connectToDatabase();
    const usersToMonitor = await db
      .collection('users')
      .find({
        // isMonitoring: true,
      })
      .project({ twitch_id: 1, _id: 0 })
      .toArray();
    return usersToMonitor;
  } catch (e) {
    console.error(e);
    return e;
  }
};

const checkS3forMessages = async (videoIds) => {
  const checkingS3Buckets = videoIds.map(async (videoId) => {
    try {
      await S3.getObject({ Bucket: BUCKET, Key: videoId }).promise();
      return null;
    } catch (err) {
      if (err.code === 'NoSuchKey') {
        return videoId;
      }
    }
  });
  const existInS3Bucket = await Promise.all(checkingS3Buckets);
  const missingVideos = existInS3Bucket.filter((id) => id !== null);
  return missingVideos;
};

const getVodsToDownload = async (numOfVodsPerStreamer) => {
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
    const url = `https://api.twitch.tv/helix/videos?user_id=${twitchId}&type=archive&first=${numOfVodsPerStreamer}`;
    const resp = await fetch(url, { headers });
    const singleStreamersVideos = await resp.json();
    singleStreamersVideos.data.forEach(({ id }) => {
      videoIds.push(id);
    });
    return singleStreamersVideos;
  });

  await Promise.all(videoPromises);
  return checkS3forMessages(videoIds);
};

const sendSnsMessages = async (missingVideoIds) => {
  const SnsTopicsSent = missingVideoIds.map(async (missingVideoId) => {
    const params = {
      Message: 'The included videoID is missing messages',
      TopicArn: TOPIC,
      MessageAttributes: {
        VideoId: {
          DataType: 'String',
          StringValue: missingVideoId,
        },
      },
    };
    const publishTextPromise = await new AWS.SNS().publish(params).promise();
    return publishTextPromise;
  });
  return Promise.all(SnsTopicsSent);
};

exports.main = async () => {
  const videoIds = await getVodsToDownload(10);
  const resp = await sendSnsMessages(videoIds);
  console.log({ resp });
  return resp;
};
