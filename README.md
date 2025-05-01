# SimpleZoom - Video Conferencing Platform

A simple video conferencing application similar to Zoom, built with React, Node.js, Express, and Socket.io.

## Features

- Create and join video meetings
- Real-time video and audio communication
- Toggle microphone and camera
- In-meeting text chat
- Simple, intuitive UI

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install server dependencies:
   ```
   npm install
   ```
3. Install client dependencies:
   ```
   cd client
   npm install
   ```

## Running the Application

### Development Mode

To run both the client and server in development mode:

```
npm run dev
```

This will start the server on port 5000 and the client on port 3000.

### Production Build

To create a production build:

```
cd client
npm run build
```

Then start the server:

```
cd ..
npm start
```

The server will serve the static files from the client build folder.

## How to Use

1. Open the application in your browser
2. Enter your name and either create a new meeting or join an existing one
3. If creating a meeting, share the room ID with others
4. If joining, enter the room ID provided by the meeting creator
5. Allow camera and microphone permissions when prompted
6. Use the controls at the bottom to toggle audio/video or end the call
7. Click the chat icon to open the chat panel and communicate via text

## Technologies Used

- **Frontend**: React, React Router, Socket.io-client, Simple-Peer, Bootstrap
- **Backend**: Node.js, Express, Socket.io

## License

MIT
