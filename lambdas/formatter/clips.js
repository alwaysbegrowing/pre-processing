import { v4 as uuidv4 } from 'uuid';

export const ClipsTypeEnum = Object.freeze({
  superclip: 'superclip', ai: 'ai', ccc: 'ccc', manual: 'manual',
});

const inRange = (x, start, end) => (x >= start && x <= end);

const doClipsOverlap = (clip, clip2) => {
  const { startTime, endTime } = clip;
  const { startTime: startTime2, endTime: endTime2 } = clip2;
  return inRange(startTime, startTime2, endTime2) || inRange(endTime, startTime2, endTime2);
};

const getSuperClip = (clip, clip2) => {
  const { startTime, endTime } = clip;
  const { startTime: startTime2, endTime: endTime2 } = clip2;

  // if the clips are the same, do not compare
  if (startTime === startTime2 && endTime === endTime2) {
    return null;
  }

  const doesOverlap = doClipsOverlap(clip, clip2);

  if (!doesOverlap) {
    return null;
  }

  // if the clip is completely contained within the clip2
  if (startTime >= startTime2 && endTime <= endTime2) {
    return { ...clip, ...clip2, type: ClipsTypeEnum.superclip };
  }

  // if the clip2 is completely contained within the clip
  if (startTime2 >= startTime && endTime2 <= endTime) {
    return { ...clip2, ...clip, type: ClipsTypeEnum.superclip };
  }

  // if clip starts before clip2
  if (startTime < startTime2) {
    return {
      ...clip2,
      ...clip,
      startTime,
      endTime: endTime2,
      type: ClipsTypeEnum.superclip,
      duration: endTime2 - startTime,
    };
  }

  // if clip2 starts before clip
  if (startTime2 < startTime) {
    return {
      ...clip,
      ...clip2,
      startTime: startTime2,
      endTime,
      type: ClipsTypeEnum.superclip,
      duration: endTime - startTime2,
    };
  }

  // if clip ends after clip2
  if (endTime > endTime2) {
    return {
      ...clip2,
      ...clip,
      startTime: startTime2,
      endTime,
      type: ClipsTypeEnum.superclip,
      duration: endTime - startTime2,
    };
  }

  // if clip2 ends after clip
  if (endTime2 > endTime) {
    return {
      ...clip,
      ...clip2,
      startTime,
      endTime: endTime2,
      type: ClipsTypeEnum.superclip,
      duration: endTime2 - startTime,
    };
  }

  return null;
};

export const findSuperClips = (clips) => {
  const superClips = [];
  clips.forEach((clip) => {
    clips.forEach((clip2) => {
      const overlap = getSuperClip(clip, clip2);
      if (overlap) {
        superClips.push(overlap);
      }
    });
  });

  return superClips;
};

// the clip hydrator
export const hydrateClips = (clips, type, thumbnails = []) => {
  console.log({ clips });
  return clips.map((clip, i) => ({
    type,
    id: uuidv4(),
    thumbnail_url: thumbnails[i],
    ...clip,
  }));
};

// removes superclip duplicates and sorts the clips
export const removeSuperClipDuplicates = (clips, superClips) => {
  const noSuperClipOverlaps = clips.filter((clip) => {
    const isSuperClip = superClips.some((superClip) => (
      doClipsOverlap(clip, superClip)
    ));
    return !isSuperClip;
  });

  return [...noSuperClipOverlaps, ...superClips];
};
