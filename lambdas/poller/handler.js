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
        twitch_id: { $ne: null },
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
      await S3.headObject({ Bucket: BUCKET, Key: videoId }).promise();

      return null;
    } catch (err) {
      if (err.code === 'NotFound') {
        return videoId;
      }
    }
  });
  const existInS3Bucket = await Promise.all(checkingS3Buckets);
  const missingVideos = existInS3Bucket.filter((id) => id !== null);
  return missingVideos;
};

const isStreamerOnlineCheck = async (twitchId, headers) => {
  const url = `https://api.twitch.tv/helix/streams?user_id=${twitchId}`;
  const resp = await fetch(url, { headers });
  const onlineStreams = await resp.json();
  if (onlineStreams?.data?.[0]) return true;
  return false;
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
    const isStreamerOnline = await isStreamerOnlineCheck(twitchId, headers);
    singleStreamersVideos.data.forEach(({ id }, i) => {
      // this is fix https://github.com/pillargg/timestamps/issues/2
      // we should not create clips for the vod if the user is still streaming
      // if we did create clips, we would be missing most of the chat messages
      if (i === 0 && isStreamerOnline) {
        return;
      }
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
  const videoIds = await getVodsToDownload(20);
  const resp = await sendSnsMessages(videoIds);
  console.log({ length: resp.length, resp });
  return resp.length;
};
