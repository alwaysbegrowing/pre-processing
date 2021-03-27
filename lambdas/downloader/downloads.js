/* 
This code uses callbacks to handle asynchronous function responses.
It currently demonstrates using an async-await pattern. 
AWS supports both the async-await and promises patterns.
For more information, see the following: 
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/calling-services-asynchronously.html
https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html 
*/
const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const fetch = require("node-fetch");

const bucketName = process.env.BUCKET;

const getMessages = async (videoId) => {
  const allMessages = [];

  const callTwitch = async (cursor = null) => {
    // use public client id thats used on twitch.tv - we could switch this to ours
    const headers = { "client-id": "kimne78kx3ncx6brgo4mv6wki5h1ko" };
    const url =
      `https://api.twitch.tv/v5/videos/${videoId}/comments` +
      (cursor ? `?cursor=${cursor}` : "");
    const resp = await fetch(url, { headers });
    const { _next, comments } = await resp.json();
    allMessages.push(...comments);

    if (_next) {
      await callTwitch(_next);
    }
  };

  await callTwitch();
  return allMessages;
};

exports.main = async function (event, context) {
  const videoId = event.Records[0].Sns.MessageAttributes.VideoId.Value;
  console.log({ bucketName, videoId });
  try {
    const allMessages = await getMessages(videoId);
    console.log({ numberOfMessages: allMessages.length });
    const resp = await S3.upload({
      Bucket: bucketName,
      key: videoId,
      Body: JSON.stringify(allMessages),
    }).promise();
    return resp;
  } catch (error) {
    const body = error.stack || JSON.stringify(error, null, 2);
    return body;
  }
};
