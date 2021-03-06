/* eslint-disable no-console */
const AWS = require('aws-sdk');

const S3 = new AWS.S3();
const fetch = require('node-fetch');

const bucketName = process.env.BUCKET;

const getMessages = async (videoId) => {
  const allMessages = [];

  const callTwitch = async (cursor = null) => {
    // use public client id thats used on twitch.tv - we could switch this to ours
    const headers = { 'client-id': 'phpnjz4llxez4zpw3iurfthoi573c8' };
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
    // eslint-disable-next-line no-await-in-loop
    cursor = await callTwitch(cursor);
  }

  return allMessages;
};

exports.main = async (event) => {
  console.log(event);

  const videoId = event?.videoId ? event.videoId
    : event.Records[0].Sns.MessageAttributes.VideoId.Value;

  const allMessages = await getMessages(videoId);
  console.log({ numberOfMessages: allMessages.length });
  const s3resp = await S3.upload({
    Bucket: bucketName,
    Key: videoId,
    Body: JSON.stringify(allMessages),
  }).promise();

  return s3resp;
};
