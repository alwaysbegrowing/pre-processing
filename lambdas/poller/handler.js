/* eslint-disable no-console */

const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const S3 = new AWS.S3();
const stepFunctions = new AWS.StepFunctions();

const { TWITCH_CLIENT_ID, BUCKET, PREPROCESSING_STATE_MACHINE_ARN } = process.env;

const VOD_LIMIT = 5;

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
    } catch (err) {
      if (err.code === 'NotFound') {
        return videoId;
      }
    }
    return null;
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

const getLastVods = async (numOfVodsPerStreamer, userId = null) => {
  let usersToPoll;
  if (userId) {
    usersToPoll = [{ twitch_id: userId }];
  } else {
    usersToPoll = await getUsersToPoll();
  }
  const appToken = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${appToken}`,
    'Client-ID': TWITCH_CLIENT_ID,
  };

  const videoIds = [];
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

  if (!videoPromises) {
    return videoIds;
  }

  await Promise.all(videoPromises);
  return videoIds;
};

const startStepFunctions = async (videoIds) => {
  const stepFunctionPromises = videoIds.map((videoId) =>
    stepFunctions
      .startExecution({
        stateMachineArn: PREPROCESSING_STATE_MACHINE_ARN,
        input: { videoId },
      })
      .promise()
  );
  return stepFunctionPromises;
};

const newUserSignUp = async (userId) => {
  const videoIds = await getLastVods(VOD_LIMIT, userId);
  return startStepFunctions(videoIds);
};

const pollVods = async () => {
  // The event that triggers this lambda isn't relevant,
  // as long as the lambda gets triggered.
  const videoIds = await getLastVods(VOD_LIMIT);
  const missingVideoIds = await checkS3forMessages(videoIds);

  return startStepFunctions(missingVideoIds);
};

exports.main = async (event) => {
  console.log(event);
  if (event?.Records) {
    const userId = event?.Records[0]?.Sns?.MessageAttributes?.TwitchId?.Value;

    if (userId) {
      return newUserSignUp(userId);
    }
  }

  return pollVods();
};
