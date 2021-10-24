import { setClipData } from './db';

const { MONGODB_FULL_URI_ARN, DB_NAME, TESTING } = process.env;

const RUN_MONGO = TESTING === 'false';

exports.main = async (event) => {
  const { clips, videoId } = event;

  const superClips = [];

  clips.forEach((clip) => {
    const { startTime, endTime } = clip;

    const overlaps = clips.every((clip2) => {
      const { startTime: startTime2, endTime: endTime2 } = clip2;
      return startTime2 <= startTime && endTime <= endTime2;
    });

    if (!overlaps) {
      superClips.push(clip);
    } else {
      overlaps.forEach((clip2) => {
        const { startTime: startTime2, endTime: endTime2 } = clip2;

        // if the clip is completely contained within the clip2
        if (startTime >= startTime2 && endTime <= endTime2) {
          superClips.push(clip2);
          return;
        }

        // if the clip2 is completely contained within the clip
        if (startTime2 >= startTime && endTime2 <= endTime) {
          superClips.push(clip);
          return;
        }

        // if clip starts before clip2
        if (startTime < startTime2) {
          superClips.push({
            ...clip,
            startTime,
            endTime: endTime2,
            type: 'superclip',
          });
        }

        // if clip2 starts before clip
        if (startTime2 < startTime) {
          superClips.push({
            ...clip2,
            startTime: startTime2,
            endTime,
            type: 'superclip',
          });
        }

        // if clip ends after clip2
        if (endTime > endTime2) {
          superClips.push({
            ...clip,
            startTime: startTime2,
            endTime,
            type: 'superclip',
          });
        }

        // if clip2 ends after clip
        if (endTime2 > endTime) {
          superClips.push({
            ...clip2,
            startTime,
            endTime: endTime2,
            type: 'superclip',
          });
        }
      });
    }
  });

  if (RUN_MONGO && superClips.length > 0) {
    const result = await setClipData(MONGODB_FULL_URI_ARN, DB_NAME, videoId, superClips);
    console.log(result);
  }

  return superClips;
};
