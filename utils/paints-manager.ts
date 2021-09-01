import { paintPoints, ScreenShot, TimeStampedPoint } from "@recordreplay/protocol";
import { assert, binarySearch } from "./utils";
import { ScreenshotCache } from "./screenshot-cache";

export interface TimeStampedPointWithPaintHash extends TimeStampedPoint {
  paintHash: string;
}

interface Timed {
  time: number;
}

// Given a sorted array of items with "time" properties, find the index of
// the most recent item at or preceding a given time.
function mostRecentIndex<T extends Timed>(array: T[], time: number): number | undefined {
  if (!array.length || time < array[0].time) {
    return undefined;
  }
  const index = binarySearch(0, array.length, (index: number) => {
    return time - array[index].time;
  });
  assert(array[index].time <= time);
  if (index + 1 < array.length) {
    assert(array[index + 1].time >= time);
  }
  return index;
}

function mostRecentEntry<T extends Timed>(array: T[], time: number) {
  const index = mostRecentIndex(array, time);
  return index !== undefined ? array[index] : null;
}

function nextEntry<T extends Timed>(array: T[], time: number) {
  const index = mostRecentIndex(array, time);
  if (index === undefined) {
    return array.length ? array[0] : null;
  }
  return index + 1 < array.length ? array[index + 1] : null;
}

// Add an entry with a "time" property to an array that is sorted by time.
function insertEntrySorted<T extends Timed>(array: T[], entry: T) {
  if (!array.length || array[array.length - 1].time <= entry.time) {
    array.push(entry);
  } else {
    const index = mostRecentIndex(array, entry.time);
    if (index !== undefined) {
      array.splice(index + 1, 0, entry);
    } else {
      array.unshift(entry);
    }
  }
}

function closerEntry<T1 extends Timed, T2 extends Timed>(
  time: number,
  entry1: T1 | null,
  entry2: T2 | null
) {
  if (!entry1) {
    return entry2;
  }
  if (!entry2) {
    return entry1;
  }
  if (Math.abs(time - entry1.time) < Math.abs(time - entry2.time)) {
    return entry1;
  }
  return entry2;
}

export class PaintsManager {
  paintPoints: TimeStampedPointWithPaintHash[] = [{ point: "0", time: 0, paintHash: "" }];
  screenshotCache;

  constructor(client: any, sessionId: string) {
    client.Graphics.addPaintPointsListener(({paints}) => this.onPaints({paints}));
    client.Graphics.findPaints({},sessionId);
    this.screenshotCache = new ScreenshotCache(sessionId);
  }

  onPaints({ paints }: paintPoints) {
    paints.forEach(({ point, time, screenShots }) => {
      const paintHash = screenShots.find(desc => desc.mimeType == "image/jpeg")!.hash;
      insertEntrySorted(this.paintPoints, { point, time, paintHash });
    });
  }

  nextPaintEvent(time: number) {
    return nextEntry(this.paintPoints, time);
  }

  previousPaintEvent(time: number) {
    const entry = mostRecentEntry(this.paintPoints, time);
    if (entry && entry.time == time) {
      return mostRecentEntry(this.paintPoints, time - 1);
    }
    return entry;
  }

  getMostRecentPaintPoint(time: number) {
    return mostRecentEntry(this.paintPoints, time);
  }

  getClosestPaintPoint(time: number) {
    const entryBefore = mostRecentEntry(this.paintPoints, time);
    const entryAfter = nextEntry(this.paintPoints, time);
    return closerEntry(time, entryBefore, entryAfter);
  }

  async getGraphicsAtTime(time: number): Promise<{ screen?: ScreenShot }> {
    const paintIndex = mostRecentIndex(this.paintPoints, time);
    if (paintIndex === undefined) {
      // There are no graphics to paint here.
      return {};
    }

    const { point, paintHash } = this.paintPoints[paintIndex];
    if (!paintHash) {
      return {};
    }

    const screenPromise = this.screenshotCache.getScreenshot(point, paintHash);

    const screen = await screenPromise;
    return { screen };
  }
}
