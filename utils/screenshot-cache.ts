import { defer } from "./utils";
import { client } from "./socket";
import { ScreenShot } from "@recordreplay/protocol";

export class DownloadCancelledError extends Error {}

export interface QueuedScreenshotDownload {
  point: string;
  paintHash: string;
  promise: Promise<ScreenShot>;
  resolve: (screenshot: ScreenShot) => void;
  reject: (reason: any) => void;
}

/**
 * This class manages the screenshot downloads and caches downloaded screenshots.
 * It throttles the screenshot downloads for preview (during the initial scan and
 * when the user hovers over the timeline or a console message), only starting one
 * download at a time and queueing one more download at most.
 * When a preview download is requested while another preview download is queued,
 * the queued download is cancelled and the requested download is queued instead.
 * Downloads for playback are run independently of those for preview.
 */
export class ScreenshotCache {
  // Map paint hashes to a promise that resolves with the associated screenshot.
  private cache = new Map<string, Promise<ScreenShot>>();
  // The set of paint hashes whose cache entry is resolved
  private cacheResolved = new Set<string>();

  private queuedDownloadForPreview: QueuedScreenshotDownload | undefined;
  private runningDownloadForPreview = false;
  private sessionId;

  constructor(sessionId) {
    this.sessionId = sessionId
  }

  /**
   * Returns a promise for the requested screenshot. The download will be started
   * immediately and will only be rejected if sendMessage() throws.
   */
  async getScreenshot(
    point: string,
    paintHash: string
  ): Promise<ScreenShot | undefined> {
    if (!paintHash) {
      return undefined;
    }
    if (this.cache.has(paintHash)) {
      return this.cache.get(paintHash)!;
    }

    const promise = this.download(point);

    this.cache.set(paintHash, promise);
    promise.then(() => this.cacheResolved.add(paintHash));
    return promise;
  }

  hasScreenshot(paintHash: string) {
    return this.cacheResolved.has(paintHash);
  }

  private async startQueuedDownloadIfPossible() {
    if (this.queuedDownloadForPreview && !this.runningDownloadForPreview) {
      this.downloadQueued();
    }
  }

  addScreenshot(screenshot: ScreenShot) {
    this.cache.set(screenshot.hash, Promise.resolve(screenshot));
    this.cacheResolved.add(screenshot.hash);
  }

  private async downloadQueued() {
    if (!this.queuedDownloadForPreview) return;

    const { point, paintHash, promise, resolve, reject } = this.queuedDownloadForPreview;

    this.queuedDownloadForPreview = undefined;
    this.runningDownloadForPreview = true;

    this.cache.set(paintHash, promise);

    try {
      const screen = await this.download(point);
      resolve(screen);
      this.cacheResolved.add(paintHash);
    } catch (e) {
      reject(e);
    }

    this.runningDownloadForPreview = false;

    this.startQueuedDownloadIfPossible();
  }

  private async download(point: string, resizeHeight?: number): Promise<ScreenShot> {
    const screen = (
      await client.Graphics.getPaintContents(
        { point, mimeType: "image/jpeg", resizeHeight },
        this.sessionId
      )
    ).screen;

    return screen;
  }
}
