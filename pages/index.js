import Head from 'next/head'
import loader from "@monaco-editor/loader";
import { useEffect } from 'react';
const recordingId = "31ce0f68-59e3-46a2-ab38-7781b0db83a6";// "41466cc2-0572-4959-be1d-d2dbd91460ac"
import {Replay} from "../utils/replay"
// https://glitch.com/edit/#!/draw-matrix?path=script.js%3A1%3A0


async function createEditor() {
  loader.init().then((monaco) => {
    const wrapper = document.getElementById("editor");;
    const properties = {
      value: "",
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
    (async () => {
      const replay = new Replay()
      await replay.init(recordingId)
      replay.fetchContents("o15").then(contents => {
        editor.setValue(contents)
      })

      const hits = await replay.getHits(
        {sourceId: "o15", line: 8, column: 0}
      )
      console.log({hits})
      replay.fetchPaints()
    })()


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
