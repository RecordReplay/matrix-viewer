## About

This app is a simple Replay client for a recording of https://hl9yc.sse.codesandbox.io/.

The UI is [React](https://reactjs.org/) app using [Next.js](https://nextjs.org/) It uses [monaco](https://microsoft.github.io/monaco-editor/) to display source files and a simple `<canvas>` to render the video.

`utils/replay.ts` includes the `Replay` class which in the primary interface for the UI to interact with the [Replay protocol](https://replay.io/protocol).

## Getting Started

First, run the development server:

```bash
npm install && npm run dev
# or
yarn && yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
