const AWS = require('aws-sdk');

const S3 = new AWS.S3();
const fetch = require('node-fetch');

const bucketName = process.env.BUCKET;

const getMessages = async (videoId) => {
  const allMessages = [];

  const callTwitch = async (cursor = null) => {
    // use public client id thats used on twitch.tv - we could switch this to ours
    const headers = { 'client-id': 'kimne78kx3ncx6brgo4mv6wki5h1ko' };
    const url = `https://api.twitch.tv/v5/videos/${videoId}/comments${
      cursor ? `?cursor=${cursor}` : ''
    }`;
    const resp = await fetch(url, { headers });
    const { _next, comments } = await resp.json();
    allMessages.push(...comments);

    return _next;
  };

  let cursor = await callTwitch();

  while (cursor) {
    cursor = await callTwitch(cursor);
  }

  return allMessages;
};

const checkIfS3KeyExists = async (videoId) => {
  const params = {
    Bucket: bucketName,
    Key: videoId,
  };
  try {
    await S3.headObject(params).promise();
  } catch (err) {
    console.log(err.code);
    return false;
  }
  return true;
};

exports.main = async (event) => {
  const videoId = event.Records[0].Sns.MessageAttributes.VideoId.Value;
  console.log({ bucketName, videoId });

  const keyFound = await checkIfS3KeyExists(videoId);
  if (keyFound) return { message: 'KEY ALREADY EXISTS IN BUCKET. TERMINATING EARLY. ' };

  const allMessages = await getMessages(videoId);
  console.log({ numberOfMessages: allMessages.length });
  const resp = await S3.upload({
    Bucket: bucketName,
    Key: videoId,
    Body: JSON.stringify(allMessages),
  }).promise();
  return resp;
};
