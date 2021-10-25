// generates "superclips", or combined clips

import { setClipData } from './db';

const { MONGODB_FULL_URI_ARN, DB_NAME, TESTING } = process.env;

const RUN_MONGO = TESTING === 'false' || TESTING === undefined;

exports.main = async (event) => {
  const { clips, videoId } = event;
  let changed = false;

  const superClips = [];

  clips.forEach((clip) => {
    const { startTime, endTime } = clip;

    const overlaps = clips.filter((clip2) => {
      const { startTime: startTime2, endTime: endTime2 } = clip2;
      // check if the clips overlap
      return (
        (startTime <= startTime2 && endTime >= startTime2) ||
        (startTime <= endTime2 && endTime >= endTime2)
      );
    });

    if (overlaps.length === 0) {
      superClips.push(clip);
    } else {
      changed = true;
      overlaps.forEach((clip2) => {
        const { startTime: startTime2, endTime: endTime2 } = clip2;

        if (startTime === startTime2 && endTime === endTime2) {
          return;
        }

        // if the clip is completely contained within the clip2
        if (startTime >= startTime2 && endTime <= endTime2) {
          superClips.push({ ...clip2, type: 'superclip' });
          return;
        }

        // if the clip2 is completely contained within the clip
        if (startTime2 >= startTime && endTime2 <= endTime) {
          superClips.push({ ...clip, type: 'superclip' });
          return;
        }

        // if clip starts before clip2
        if (startTime < startTime2) {
          superClips.push({
            ...clip,
            startTime,
            endTime: endTime2,
            type: 'superclip',
            duration: endTime2 - startTime,
          });
          return;
        }

        // if clip2 starts before clip
        if (startTime2 < startTime) {
          superClips.push({
            ...clip2,
            startTime: startTime2,
            endTime,
            type: 'superclip',
            duration: endTime - startTime2,
          });
          return;
        }

        // if clip ends after clip2
        if (endTime > endTime2) {
          superClips.push({
            ...clip,
            startTime: startTime2,
            endTime,
            type: 'superclip',
            duration: endTime - startTime2,
          });
          return;
        }

        // if clip2 ends after clip
        if (endTime2 > endTime) {
          superClips.push({
            ...clip2,
            startTime,
            endTime: endTime2,
            type: 'superclip',
            duration: endTime2 - startTime,
          });
        }
      });
    }
  });

  const clipObject = {
    clips: [...superClips, ...clips].filter(
      (thing, index, self) =>
        index ===
        self.findIndex((t) => t.startTime === thing.startTime && t.endTime === thing.endTime),
    ),
  };

  if (RUN_MONGO && changed) {
    const result = await setClipData(MONGODB_FULL_URI_ARN, DB_NAME, videoId, clipObject);
    console.log(result);
  }

  return clipObject;
};
