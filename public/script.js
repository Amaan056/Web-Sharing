const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');
const sendFileButton = document.getElementById('send-file-button');
const sendMessageButton = document.getElementById('send-message-button');
const connectionStatus = document.getElementById('connection-status');
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const messageInput = document.getElementById('message-input');
const fileProgressBar = document.getElementById('file-progress-bar');
const fileProgressText = document.getElementById('file-progress-text');
const fileProgressContainer = document.getElementById('file-progress-container');
const receivedFilesList = document.getElementById('received-files-list');
const receivedMessagesList = document.getElementById('received-messages-list');

let peerConnection;
let dataChannel;
let signalingChannel;
let isInitiator = false;

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// File transfer variables
const chunkSize = 16 * 1024; // 16KB
let fileToSend;
let fileReader;
let receivedBuffers = [];
let receivedFileName = '';
let receivedFileSize = 0;
let receivedBytes = 0;

function updateConnectionStatus(status, isConnected) {
    connectionStatus.textContent = status;
    if (isConnected) {
        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
        disconnectButton.disabled = false;
        sendFileButton.disabled = false;
        sendMessageButton.disabled = false;
    } else {
        connectionStatus.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
        disconnectButton.disabled = true;
        sendFileButton.disabled = true;
        sendMessageButton.disabled = true;
    }
}

function setupSignalingChannel() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    signalingChannel = new WebSocket(`${protocol}://${location.host}`);

    signalingChannel.onopen = () => {
        console.log('Signaling channel connected');
        connectButton.disabled = false;
    };

    signalingChannel.onmessage = async message => {
        const data = JSON.parse(message.data);

        if (data.type === 'offer') {
            console.log('Received offer');
            peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingChannel.send(JSON.stringify(peerConnection.localDescription));
        } else if (data.type === 'answer') {
            console.log('Received answer');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        } else if (data.type === 'candidate') {
            console.log('Received ICE candidate');
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Error adding received ICE candidate', e);
            }
        }
    };

    signalingChannel.onclose = () => {
        console.log('Signaling channel disconnected');
        updateConnectionStatus('Disconnected (Signaling Lost)', false);
        connectButton.disabled = false;
    };

    signalingChannel.onerror = error => {
        console.error('Signaling channel error:', error);
        updateConnectionStatus('Disconnected (Signaling Error)', false);
        connectButton.disabled = false;
    };
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate');
            signalingChannel.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('RTC connection state change:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            updateConnectionStatus('Connected', true);
        } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
            updateConnectionStatus('Disconnected', false);
        }
    };

    peerConnection.ondatachannel = event => {
        console.log('Received data channel');
        dataChannel = event.channel;
        setupDataChannel();
    };
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('Data channel opened');
        updateConnectionStatus('Connected', true);
    };

    dataChannel.onmessage = async event => {
        if (typeof event.data === 'string') {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-start') {
                    receivedFileName = message.name;
                    receivedFileSize = message.size;
                    receivedBytes = 0;
                    receivedBuffers = [];
                    fileProgressContainer.style.display = 'block';
                    updateFileProgress(0, `Receiving: ${receivedFileName}`);
                    console.log(`Receiving file: ${receivedFileName} (${receivedFileSize} bytes)`);
                } else if (message.type === 'file-end') {
                    console.log('File transfer complete');
                    const receivedBlob = new Blob(receivedBuffers);
                    const url = URL.createObjectURL(receivedBlob);
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = receivedFileName;
                    link.textContent = `${receivedFileName} (${formatBytes(receivedFileSize)})`;
                    listItem.appendChild(link);
                    receivedFilesList.appendChild(listItem);
                    receivedBuffers = [];
                    receivedFileName = '';
                    receivedFileSize = 0;
                    receivedBytes = 0;
                    fileProgressContainer.style.display = 'none';
                    updateFileProgress(0, '');
                } else {
                    // Regular text message
                    const listItem = document.createElement('li');
                    listItem.textContent = `Peer: ${message.text}`;
                    receivedMessagesList.appendChild(listItem);
                }
            } catch (e) {
                // Fallback for non-JSON messages (simple text)
                const listItem = document.createElement('li');
                listItem.textContent = `Peer: ${event.data}`;
                receivedMessagesList.appendChild(listItem);
            }
        } else {
            // Binary data (file chunks)
            receivedBuffers.push(event.data);
            receivedBytes += event.data.byteLength;
            const progress = (receivedBytes / receivedFileSize) * 100;
            updateFileProgress(progress, `Receiving: ${receivedFileName} (${formatBytes(receivedBytes)} / ${formatBytes(receivedFileSize)})`);
        }
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
        updateConnectionStatus('Disconnected', false);
    };

    dataChannel.onerror = error => {
        console.error('Data channel error:', error);
    };
}

async function createOffer() {
    createPeerConnection();
    dataChannel = peerConnection.createDataChannel('file_transfer');
    setupDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingChannel.send(JSON.stringify(peerConnection.localDescription));
    isInitiator = true;
    updateConnectionStatus('Connecting...', false);
}

function disconnect() {
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
    if (signalingChannel) {
        signalingChannel.close();
    }
    updateConnectionStatus('Disconnected', false);
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendFileButton.disabled = true;
    sendMessageButton.disabled = true;
    isInitiator = false;
    console.log('Disconnected');
}

function sendFile() {
    if (!fileToSend || !dataChannel || dataChannel.readyState !== 'open') {
        alert('Please select a file and ensure connection is open.');
        return;
    }

    console.log('Sending file:', fileToSend.name, fileToSend.size);
    dataChannel.send(JSON.stringify({
        type: 'file-start',
        name: fileToSend.name,
        size: fileToSend.size
    }));

    fileReader = new FileReader();
    let offset = 0;

    fileReader.onload = event => {
        if (event.target.readyState === FileReader.DONE) {
            const chunk = event.target.result;
            dataChannel.send(chunk);
            offset += chunk.byteLength;
            const progress = (offset / fileToSend.size) * 100;
            updateFileProgress(progress, `Sending: ${fileToSend.name} (${formatBytes(offset)} / ${formatBytes(fileToSend.size)})`);

            if (offset < fileToSend.size) {
                readNextChunk();
            } else {
                dataChannel.send(JSON.stringify({ type: 'file-end' }));
                console.log('File sent successfully!');
                fileProgressContainer.style.display = 'none';
                updateFileProgress(0, '');
                fileToSend = null;
                fileInput.value = '';
            }
        }
    };

    fileReader.onerror = error => {
        console.error('Error reading file:', error);
        alert('Error reading file.');
        fileProgressContainer.style.display = 'none';
        updateFileProgress(0, '');
    };

    function readNextChunk() {
        const slice = fileToSend.slice(offset, offset + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    }

    fileProgressContainer.style.display = 'block';
    updateFileProgress(0, `Sending: ${fileToSend.name}`);
    readNextChunk();
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'text', text: message }));
        const listItem = document.createElement('li');
        listItem.textContent = `You: ${message}`;
        receivedMessagesList.appendChild(listItem);
        messageInput.value = '';
    } else {
        alert('Please type a message and ensure connection is open.');
    }
}

function updateFileProgress(percentage, text) {
    fileProgressBar.style.width = `${percentage}%`;
    fileProgressText.textContent = text;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Event Listeners
connectButton.addEventListener('click', createOffer);
disconnectButton.addEventListener('click', disconnect);
sendFileButton.addEventListener('click', sendFile);
sendMessageButton.addEventListener('click', sendMessage);

dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropArea.classList.add('highlight');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
});

dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dropArea.classList.remove('highlight');
    fileToSend = event.dataTransfer.files[0];
    if (fileToSend) {
        console.log('File selected:', fileToSend.name);
        fileInput.value = ''; // Clear file input if any
    }
});

fileInput.addEventListener('change', (event) => {
    fileToSend = event.target.files[0];
    if (fileToSend) {
        console.log('File selected:', fileToSend.name);
    }
});

// Initial setup
updateConnectionStatus('Disconnected', false);
setupSignalingChannel();
