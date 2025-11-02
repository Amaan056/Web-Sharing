# WebRTC File Transfer App

This is a WebRTC-based file and data transfer web application that allows two peers on the same local network to exchange files and messages directly, even without an active internet connection after the initial page load. It uses a local WebSocket server for signaling and a Service Worker for offline static asset caching.

## Features

- **Peer-to-Peer Connection:** Establishes direct WebRTC DataChannel connections.
- **File Transfer:** Drag-and-drop interface for sending and receiving files with progress indicators.
- **Text Messaging:** Send and receive text messages between peers.
- **Offline Support:** Once loaded, the app functions entirely offline on a local Wi-Fi network thanks to Service Worker caching.
- **No Database:** Operates without any backend database.
- **Minimal UI:** Clean, responsive user interface with light/dark mode support.

## Project Structure

```
webrtc-file-transfer/
├── public/
│   ├── index.html             # Main HTML file
│   ├── script.js              # Frontend JavaScript logic
│   ├── style.css              # Styling for the UI
│   └── sw.js                  # Service worker for offline support
├── server/
│   └── signaling-server.js    # Local WebSocket signaling server (Node.js)
├── package.json               # Project dependencies and scripts
└── README.md                  # This README file
```

## Setup and Usage

### Prerequisites

- Node.js (LTS version recommended)
- npm (Node Package Manager, usually comes with Node.js)

### Installation

1. **Clone the repository (or create the files manually as per the instructions):**
   ```bash
   git clone <repository-url>
   cd webrtc-file-transfer
   ```

2. **Install dependencies:**
   Navigate to the project root directory and run:
   ```bash
   npm install
   ```

### Running the Application

1. **Start the signaling server and static file server:**
   From the project root directory, run:
   ```bash
   npm start
   ```
   The server will start on `http://localhost:8080`.

2. **Access the application:**
   Open your web browser and navigate to `http://localhost:8080`.

3. **Connect Peers:**
   - Open the application on two different devices (or two browser tabs/windows) connected to the **same Wi-Fi network**.
   - Click the "Connect" button on both instances. The signaling server will facilitate the WebRTC handshake.
   - Once connected, the status indicator will change to "Connected".

4. **Transfer Files:**
   - Drag and drop a file onto the "Drag & Drop Files Here" area, or use the (hidden) file input.
   - Click "Send File". A progress bar will show the transfer status.
   - The receiving peer will see the file progress and can download the received file.

5. **Send Messages:**
   - Type a message into the text area.
   - Click "Send Message". The message will appear in the "Received Messages" list on the other peer's screen.

### Offline Functionality

- After the initial page load, the application's static assets are cached by the Service Worker.
- If your internet connection drops, the application will still load from the cache.
- As long as both devices remain on the same local Wi-Fi network, the established WebRTC connection will persist, allowing file and data transfer to continue seamlessly.

## How it Works

- **WebRTC DataChannel:** Used for direct, secure, and low-latency peer-to-peer communication for both files and text.
- **WebSocket Signaling:** A simple Node.js WebSocket server handles the initial exchange of SDP (Session Description Protocol) offers/answers and ICE (Interactive Connectivity Establishment) candidates to set up the WebRTC connection.
- **STUN Server:** `stun:stun.l.google.com:19302` is used to help peers discover their public IP addresses if they are behind NATs (Network Address Translators).
- **Service Worker:** Caches `index.html`, `style.css`, and `script.js` to enable the application to load and function even when there's no internet connection.

## Future Enhancements (Optional)

- **QR Code Signaling:** Implement a fallback for manual signaling using QR codes for environments where even local WebSocket signaling might be challenging (e.g., strict network configurations).
- **Multiple File Selection:** Allow users to select and send multiple files at once.
- **Transfer Queue:** Manage multiple file transfers with a queue system.
- **Error Handling:** More robust error handling and user feedback for connection issues or transfer failures.
- **UI Improvements:** Further refine the UI/UX with more animations, detailed progress, and better responsiveness.
