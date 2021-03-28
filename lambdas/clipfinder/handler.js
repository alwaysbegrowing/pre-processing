const AWS = require('aws-sdk');
const S3 = new AWS.S3();

// this algorithm is trash and needs improved ASAP
// it's possible for a timestamp here to be past the end of
// the video which may make a bug somewhere else in our stack
const basicClipAlgorithm = (allMessages, numberOfClips) => {
  const clipCounts = [];
  let endTime = 60;
  let lastIndex = 0;

  allMessages.forEach((item, currentIndex) => {
    if (item.content_offset_seconds > endTime) {
      const messageCount = currentIndex - lastIndex;
      clipCounts.push({
        startTime: endTime - 60,
        endTime,
        messageCount,
      });
      lastIndex = currentIndex;
      endTime += 60;
    }
  });
  clipCounts.sort((a, b) => b.messageCount - a.messageCount);
  return clipCounts.slice(0, numberOfClips);
};

exports.main = async (event) => {
  const { name } = event.Records[0].s3.bucket;
  const { key } = event.Records[0].s3.object;
  const { Body } = await S3.getObject({ Bucket: name, Key: key }).promise();
  const allMessages = JSON.parse(Body.toString('utf-8'));
  const clips = basicClipAlgorithm(allMessages, 5);
  console.log(clips);
  return clips;
};