// generates "superclips", or combined clips

import { setClipData } from './db';

const { MONGODB_FULL_URI_ARN, DB_NAME, TESTING } = process.env;

const RUN_MONGO = TESTING === 'false' || TESTING === undefined;

exports.main = async (event) => {
  const { clips, videoId } = event;

  const superClips = [];

  clips.forEach((clip) => {
    const { startTime, endTime } = clip;

    const overlaps = clips.filter((clip2) => {
      const { startTime: startTime2, endTime: endTime2 } = clip2;
      // check if the clips overlap
      return (
        // using >= and <= to account for clips where one time could be the same
        // but the other is not. Duplicates are handled later in the function.
        (startTime <= startTime2 && endTime >= startTime2)
        || (startTime <= endTime2 && endTime >= endTime2)
      );
    });

    if (overlaps.length === 0) {
      superClips.push(clip);
    } else {
      overlaps.forEach((clip2) => {
        const { startTime: startTime2, endTime: endTime2 } = clip2;

        // skip if the clips are the same
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

  // only update if there are changes
  if (superClips.length > 0) {
    // construct the final clips array and filter duplicates
    const finalClips = [...superClips, ...clips].filter(
      (thing, index, self) => index
        === self.findIndex((t) => t.startTime === thing.startTime && t.endTime === thing.endTime),
    );

    const clipObject = {
      clips: finalClips,
    };

    if (RUN_MONGO) {
      const result = await setClipData(MONGODB_FULL_URI_ARN, DB_NAME, videoId, clipObject);
      console.log(result);
    }

    return clipObject;
  }

  return { clips };
};
