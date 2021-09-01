import { PaintsManager } from "./paints-manager";

const isServer = () => typeof window === 'undefined';
let gPaints


export class Replay {

  devicePixelRatio = 1
  lastBounds;
  client;
  socket;
  sessionId;
  paintsManager;

  sendMessage(command, params) {
    return this.socket.sendMessage(command, params, this.sessionId)
  }

  async init(recordingId) {
    const sessionId = await this.createSession(recordingId);
    if (!sessionId) {
      return;
    }
    this.paintsManager = new PaintsManager(this.client, sessionId)

    this.client.Debugger.addNewSourceListener(source => {})
    await this.sendMessage("Debugger.findSources", {});
  }


  async createSession(recordingId) {
    if (isServer()) {
      return
    }
    const socket = await import("./socket")
    socket.initSocket()


    const { sessionId } = await socket.sendMessage("Recording.createSession", {
      recordingId,
    })

    this.sessionId = sessionId;
    this.client = socket.client
    this.socket = socket;

    return sessionId;
  }


  calculateBounds(containerBounds, image) {

    const maxScale = 1 / (this.devicePixelRatio || 1);
    let bounds = { height: 0, width: 0, left: 0, top: 0, scale: 1 };

    if (image && image.width > 0 && image.height > 0) {
      bounds.width = image.width;
      bounds.height = image.height;
    } else {
      return this.lastBounds || bounds;
    }
  
    bounds.scale = Math.min(
      containerBounds.width / bounds.width,
      containerBounds.height / bounds.height,
      maxScale
    );
  
    const drawWidth = bounds.width * bounds.scale;
    const drawHeight = bounds.height * bounds.scale;
    bounds.left = (containerBounds.width - drawWidth) / 2;
    bounds.top = (containerBounds.height - drawHeight) / 2;
  
    this.lastBounds = bounds;
    return bounds;
  }

  async fetchContents(sourceId) {
    const {contents} = await this.sendMessage("Debugger.getSourceContents", {sourceId: "o15"})
    return contents
  }


  async fetchPaints() {
    // this.socket.addEventListener("Graphics.paintPoints", async ({paints}) => {
    //   console.log({paints})

    //   let count = 0;
    //   let int = setInterval(async () => {
    //     const paint = paints[count++]
    //     if (!paint) {
    //       clearInterval(int)
    //       return
    //     }
    //     console.log(count)
    //     const {screen} = await this.paintsManager.getGraphicsAtTime()

    //     // const { screen } = await this.sendMessage(
    //     //   "Graphics.getPaintContents",
    //     //   {point, mimeType: "image/jpeg", resizeHeight: undefined},
    //     // )

    //     this.refreshGraphics(screen)

    //   }, 200)
    // })

    // await this.sendMessage("Graphics.findPaints",{});
  }

  async refreshGraphics(screenShot){
    const canvas = document.getElementById("graphics")
    const cx = canvas.getContext("2d");
    const image = new Image();
    image.onload = () => {
      const bounds = this.calculateBounds({width: 500, height: 400}, image)
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      // canvas.style.transform = `scale(${bounds.scale})`;
      canvas.style.left = String(bounds.left) + "px";
      canvas.style.top = String(bounds.top) + "px";
  
      cx.drawImage(image, 0, 0);
  
    };
    image.src = `data:${screenShot.mimeType};base64,${screenShot.data}`;
  }

  async playHits(points) {
    let count = 0
    setInterval(async () => {
      const point = points[count++]
      if (!point) return;
      const {time} = point;
      const {screen} = await this.paintsManager.getGraphicsAtTime(time)
      this.refreshGraphics(screen)
    }, 200)
  }

  async getHits(location) {
    return new Promise(async (resolve) => {
      const { analysisId } = await this.sendMessage(
        "Analysis.createAnalysis",
        {
          mapper: `
          const { point, time, pauseId } = input;
          return [{
            key: point,
            value: input,
          }];
          `,
          effectful: false,
        }
      );

      this.socket.addEventListener("Analysis.analysisPoints", (points) => {
        console.log({points})
        resolve(points)
      });

      await this.sendMessage("Debugger.getPossibleBreakpoints", {sourceId: location.sourceId})
      await this.sendMessage("Analysis.addLocation", { analysisId, location })
      this.sendMessage("Analysis.findAnalysisPoints", { analysisId });
    })
  }

}