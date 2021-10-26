const inRange = (x, start, end) => (x >= start && x <= end);

const roundToMs = (num) => Math.round(num * 1000);

const doClipsOverlap = (clip, clip2) => {
  const { startTime: startTimeFloat, endTime: endTimeFloat } = clip;
  const { startTime: startTime2Float, endTime: endTime2Float } = clip2;

  const startTime = roundToMs(startTimeFloat);
  const endTime = roundToMs(endTimeFloat);
  const startTime2 = roundToMs(startTime2Float);
  const endTime2 = roundToMs(endTime2Float);

  // if the clips are the same, do not compare
  if (startTime === startTime2 && endTime === endTime2) {
    return null;
  }

  // if clip starts within clip2
  const startInClip2 = inRange(startTime, startTime2, endTime2);
  // clip ends within clips2
  const endInClip2 = inRange(endTime, startTime2, endTime2);

  // if the clips do not overlap, do not compare
  if (!(startInClip2 || endInClip2)) {
    return null;
  }

  // if the clip is completely contained within the clip2
  if (startTime >= startTime2 && endTime <= endTime2) {
    return { ...clip2, type: 'superclip' };
  }

  // if the clip2 is completely contained within the clip
  if (startTime2 >= startTime && endTime2 <= endTime) {
    return { ...clip, type: 'superclip' };
  }

  // if clip starts before clip2
  if (startTime < startTime2) {
    return {
      ...clip,
      startTime,
      endTime: endTime2,
      type: 'superclip',
      duration: endTime2 - startTime,
    };
  }

  // if clip2 starts before clip
  if (startTime2 < startTime) {
    return {
      ...clip2,
      startTime: startTime2,
      endTime,
      type: 'superclip',
      duration: endTime - startTime2,
    };
  }

  // if clip ends after clip2
  if (endTime > endTime2) {
    return {
      ...clip,
      startTime: startTime2,
      endTime,
      type: 'superclip',
      duration: endTime - startTime2,
    };
  }

  // if clip2 ends after clip
  if (endTime2 > endTime) {
    return {
      ...clip2,
      startTime,
      endTime: endTime2,
      type: 'superclip',
      duration: endTime2 - startTime,
    };
  }

  return null;
};

export default doClipsOverlap;
