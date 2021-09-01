import Head from 'next/head'
import loader from "@monaco-editor/loader";
import { useEffect } from 'react';
const recordingId = "31ce0f68-59e3-46a2-ab38-7781b0db83a6";// "41466cc2-0572-4959-be1d-d2dbd91460ac"

const isServer = () => typeof window === 'undefined';
let gPaints
// https://glitch.com/edit/#!/draw-matrix?path=script.js%3A1%3A0


async function createSession(recordingId) {
  if (isServer()) {
    return
  }
  console.log('not server')
  const socket = await import("./socket")
  console.log({socket})
  socket.initSocket()
  const { sessionId } = await socket.sendMessage("Recording.createSession", {
    recordingId,
  })

  return {sessionId, socket}
}

let gDevicePixelRatio = 1
let gLastBounds;
function calculateBounds(containerBounds, image) {
  const maxScale = 1 / (gDevicePixelRatio || 1);
  let bounds = { height: 0, width: 0, left: 0, top: 0, scale: 1 };

  if (image && image.width > 0 && image.height > 0) {
    bounds.width = image.width;
    bounds.height = image.height;
  } else {
    return gLastBounds || bounds;
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

  gLastBounds = bounds;
  return bounds;
}


async function refreshGraphics(screenShot){
  const canvas = document.getElementById("graphics")
  const cx = canvas.getContext("2d");
  const image = new Image();
  image.onload = () => {
    const bounds = calculateBounds({width: 500, height: 400}, image)
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    // canvas.style.transform = `scale(${bounds.scale})`;
    canvas.style.left = String(bounds.left) + "px";
    canvas.style.top = String(bounds.top) + "px";

    cx.drawImage(image, 0, 0);

  };
  image.src = `data:${screenShot.mimeType};base64,${screenShot.data}`;


}

async function getHits(sessionId, socket, location) {
  const { analysisId } = await socket.sendMessage(
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
    },
    sessionId
  );

  socket.addEventListener("Analysis.analysisPoints", (points) => {
    console.log({points})
  });

  console.log(location)
  await socket.sendMessage("Analysis.addLocation", { analysisId, location }, sessionId)
  socket.sendMessage("Analysis.findAnalysisPoints", { analysisId }, sessionId),
  console.log({analysisId})
}

async function createEditor() {
  loader.init().then((monaco) => {
    const wrapper = document.getElementById("editor");;
    const properties = {
      value: "function hello() {\n\talert('Hello world!');\n}",
      language: "javascript",
      IEditorMinimapOptions: {
        enabled: false
      },

      // IEditorOptions: {
      //   fontSize: 34,
      //   lineHeight: 40
      // },

      lineNumbers: "off",
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: true,
      theme: "vs-dark",
      fontSize: "16px"
    };
    editor = monaco.editor.create(wrapper, properties);

    // import('monaco-themes/themes/Monokai.json')
    //   .then(data => {
    //       // monaco.editor.defineTheme('monokai', data);
    //       // monaco.editor.setTheme('monokai');
    //   })
  })
}

let editor;
export default function Home() {
  useEffect(()=> {
    createEditor();
  }, [])

  useEffect(() => {
    createSession(recordingId).then(async ({socket, sessionId}) => {
      console.log({sessionId, recordingId})


      socket.client.Debugger.addNewSourceListener(source => {
        // console.log(source)
      })

      socket.client.Debugger.findSources({}, sessionId)

      const {contents} = await socket.client.Debugger.getSourceContents({sourceId: "o15"}, sessionId)
      // console.log({contents})
      editor.setValue(contents)

      const hits = await getHits(sessionId, socket, {sourceId: "o15", line: 8, column: 0})


      socket.addEventListener("Graphics.paintPoints", async ({paints}) => {
        console.log({paints})
        gPaints = paints
        console.log({point: paints[0].point, mimeType: "image/jpeg"})

        let count = 0;
        let int = setInterval(async () => {
          const point = paints[count++]?.point
          if (!point) {
            clearInterval(int)
            return
          }
          console.log(count)
          const {screen} = await socket.client.Graphics.getPaintContents(
            {point, mimeType: "image/jpeg", resizeHeight: undefined},
            sessionId
          )

          refreshGraphics(screen)

        }, 200)
        console.log({screen})
      })

      const paints = await socket.client.Graphics.findPaints({}, sessionId)
      console.log({paints})
    })
  },[])
  return (
    <div >
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main >
      <div id="editor"></div>
      <canvas id="graphics"></canvas>
      </main>

    </div>
  )
}
