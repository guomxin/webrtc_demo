'use strict';

//set constraints
const mediaStreamConstraints = {
	video: true,
};

// Set up to exchange only video.
const offerOptions = {
	offerToReceiveVideo: 1,
};

// Define connection to signal server
let socket = io.connect('https://192.168.0.27');
const room = 1;

socket.on("joined", (room) => {
	trace(`Joined room: ${room}`);
});

socket.on("full", (room) => {
	trace(`Room: ${room} is full.`);
});

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let peerConnection;

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);

// Sets the MediaStream as the video element src.
function gotLocalMediaStream(mediaStream) {
	localVideo.srcObject = mediaStream;
	localStream = mediaStream;
	trace('Received local stream.');
	callButton.disabled = false;  // Enable call button.
}

// Handles error by logging a message to the console.
function handleLocalMediaStreamError(error) {
	trace(`navigator.getUserMedia error: ${error.toString()}.`);
}

function startAction() {
	startButton.disabled = true;
	navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
		.then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
	trace("Requesting local stream.")

	socket.emit("join", room);

	var configuration = {
		iceServers: [
			{
				urls: "stun:stun.xten.com"
			}
		]
	};
	// Create peer connections and add behavior.
	peerConnection = new RTCPeerConnection(configuration);
	trace('Created peer connection object.');
	peerConnection.addEventListener('icecandidate', handleConnection);
	peerConnection.addEventListener('addstream', gotRemoteMediaStream);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
	trace(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setLocalDescriptionSuccess() {
	trace('Finished setting local description.');
}
function setRemoteDescriptionSuccess() {
	trace('Finished setting remote description.');
}

function createdOffer(description) {
	trace(`[Caller] Offer from local PeerConnection:\n${description.sdp}`);

	trace('[Caller] PeerConnection setLocalDescription start.');
	peerConnection.setLocalDescription(description)
		.then(setLocalDescriptionSuccess)
		.catch(setSessionDescriptionError);

	// Send to signal server
	socket.emit('caller-send-sdp', room, description);
}

socket.on("receiver-recv-sdp", (description) => {
	trace(`[Receiver] Received sdp: ${description.sdp}`);
	trace('[Receiver] PeerConnection setRemoteDescription start.');
	peerConnection.setRemoteDescription(description)
		.then(setRemoteDescriptionSuccess)
		.catch(setSessionDescriptionError);

	trace('[Receiver] PeerConnection createAnswer start.');
	peerConnection.createAnswer()
		.then(createdAnswer)
		.catch(setSessionDescriptionError);
});

// Logs answer to offer creation and sets peer connection session descriptions.
function createdAnswer(description) {
	trace(`[Receiver] Answer from PeerConnection:\n${description.sdp}.`);
	trace('[Receiver] PeerConnection setLocalDescription start.');
	peerConnection.setLocalDescription(description)
		.then(setLocalDescriptionSuccess)
		.catch(setSessionDescriptionError);

	// Send to signal server
	socket.emit('receiver-send-sdp', room, description);
}

socket.on("caller-recv-sdp", (description) => {
	trace(`[Caller] Received sdp: ${description.sdp}`);
	trace('[Caller] PeerConnection setRemoteDescription start.');
	peerConnection.setRemoteDescription(description)
		.then(setRemoteDescriptionSuccess)
		.catch(setSessionDescriptionError);
});

// Handles call button action: creates peer connection.
function callAction() {
	callButton.disabled = true;
	hangupButton.disabled = false;
	trace('Starting call.');

	if (peerConnection == null) {
		var configuration = {
			iceServers: [
				{
					urls: "stun:stun.xten.com"
				}
			]
		};
		// Create peer connections and add behavior.
		peerConnection = new RTCPeerConnection(configuration);
		trace('Created peer connection object.');
		peerConnection.addEventListener('icecandidate', handleConnection);
		peerConnection.addEventListener('addstream', gotRemoteMediaStream);
	}


	// Get local media stream tracks.
	const videoTracks = localStream.getVideoTracks();
	const audioTracks = localStream.getAudioTracks();
	if (videoTracks.length > 0) {
		trace(`Using video device: ${videoTracks[0].label}.`);
	}
	if (audioTracks.length > 0) {
		trace(`Using audio device: ${audioTracks[0].label}.`);
	}

	peerConnection.addStream(localStream);
	trace('Added local stream to peerConnection.');

	trace('CreateOffer start.');
	peerConnection.createOffer(offerOptions)
		.then(createdOffer).catch(setSessionDescriptionError);
}

// Connects with new peer candidate.
function handleConnection(event) {
	const iceCandidate = event.candidate;
	if (iceCandidate) {
		trace(`[send-ice] ${iceCandidate.candidate}`);
		socket.emit('send-ice', room, iceCandidate);
	}
}

socket.on('recv-ice', (iceCandidate) => {
	trace(`[recv-ice] ${iceCandidate.candidate}`);
	peerConnection.addIceCandidate(iceCandidate)
		.then(handleConnectionSuccess)
		.catch(handleConnectionFailure);
});

// Logs that the connection succeeded.
function handleConnectionSuccess() {
	trace('AddIceCandidate success.');
};

// Logs that the connection failed.
function handleConnectionFailure(error) {
	trace(`Failed to add ICE Candidate:\n` + `${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
	const mediaStream = event.stream;
	remoteVideo.srcObject = mediaStream;
	trace('Peer connection received remote stream.');
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
	peerConnection.close();
	peerConnection = null;
	hangupButton.disabled = true;
	callButton.disabled = false;
	trace('Ending call.');
}

// Define helper functions

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
	text = text.trim();
	const now = (window.performance.now() / 1000).toFixed(3);
	console.log(now, text);
}