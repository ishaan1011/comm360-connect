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

## Deployment

This application is designed to be deployed with the frontend on Vercel and the backend on Render.

### Deploying the Frontend to Vercel

1. Sign up or log in to [Vercel](https://vercel.com/)
2. Connect your GitHub repository or use the Vercel CLI
3. Configure the deployment:
   - Root directory: `client`
   - Build command: `npm run build`
   - Output directory: `build`
4. Before deploying to production, update the `.env` file in the client directory:
   ```
   # Comment out the development URL
   # REACT_APP_SERVER_URL=http://localhost:9000
   # Uncomment and set the production URL to your Render backend
   REACT_APP_SERVER_URL=https://your-render-app-name.onrender.com
   ```
5. Deploy the application

### Deploying the Backend to Render

1. Sign up or log in to [Render](https://render.com/)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure the deployment:
   - Name: `simple-zoom-backend` (or your preferred name)
   - Root directory: `server`
   - Runtime: `Node`
   - Build command: `npm install`
   - Start command: `npm start`
5. Add environment variables:
   - `PORT`: `9000`
   - `CLIENT_URL`: Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
6. Deploy the application

Alternatively, you can use the included `render.yaml` file for Blueprint deployment:

1. Update the `CLIENT_URL` in the `render.yaml` file with your Vercel URL
2. Go to the Render Dashboard
3. Click on "Blueprints"
4. Connect your repository and deploy using the Blueprint

## License

MIT
