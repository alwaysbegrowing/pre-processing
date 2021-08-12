/* eslint-disable no-console */
// const AWS = require('aws-sdk');
// const S3 = new AWS.S3();
const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const S3 = new AWS.S3();

const {
  TWITCH_CLIENT_ID, TOPIC, BUCKET, REFRESH_VOD_TOPIC,
} = process.env;

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

const getLastVods = async (numOfVodsPerStreamer) => {
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
  return videoIds;
};

const sendMissingVideosSns = async (missingVideoIds) => {
  // missingVideoIDs: Video IDs that are not in the S3 bucket.
  console.log({ missingVideoIds });
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

const newUserSignUp = async (userId) => {
  // get twitch access token
  const accessToken = await getAccessToken();

  // construct twitch headers
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-ID': TWITCH_CLIENT_ID,
  };

  // construct url to get user's last 5 vods
  const url = `https://api.twitch.tv/helix/videos?user_id=${userId}&limit=${VOD_LIMIT}&type=archive`;

  // fetch url
  const response = await fetch(url, { headers });

  if (!response.ok) {
    return { error: `Error fetching user's last 5 vods: ${response.status} ${response.statusText}` };
  }

  // get data from json body
  const { data } = await response.json();

  const videoIds = data.slice(0, VOD_LIMIT).map(({ id }) => id);

  // send refresh vod sns
  const refreshVodResponse = await sendRefreshVodSns(videoIds);
  const resp = { refreshVodResponse };

  console.log(resp);
  return resp;
};

const refreshVods = async () => {
  // The event that triggers this lambda isn't relevant,
  // as long as the lambda gets triggered.
  const videoIds = await getLastVods(5);
  const missingVideoIds = await checkS3forMessages(videoIds);
  const missingVideosResponse = await sendMissingVideosSns(missingVideoIds);

  const refreshVodResponse = await sendRefreshVodSns(videoIds);

  console.log({
    missingVideoIdsLength: missingVideosResponse.length,
    missingVideosResponse,
    refreshVodResponse,
  });
  return { missingVideoIdsLength: missingVideosResponse.length };
};

exports.main = async (event) => {
  if (event?.Records) {
    const userId = event?.Records[0]?.Sns?.MessageAttributes?.TwitchId?.Value;

    if (userId) {
      return newUserSignUp(userId);
    }
  }

  return refreshVods();
};
