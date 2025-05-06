// --- Cleaned & Fixed Room.js ---

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Alert } from 'react-bootstrap';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaComments, FaCopy } from 'react-icons/fa';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import ChatPanel from './ChatPanel';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);

  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const userId = useRef(Math.floor(Math.random() * 1000000).toString());
  
  // Define peer functions before using them in useEffect
  const createPeer = (userToSignal, callerID, stream) => {
    console.log('Creating initiator peer to signal:', userToSignal);
    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [
          // Multiple STUN servers for redundancy
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Free TURN servers with updated credentials
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: '1070fef0748a27dcef18e16c8aa5649786dd9d91369fd02e35be3074f1d763eb',
            credential: '/uAc0y/EsXnG8P5gV7l37nbz5zsXXZWv1P3jYEGZgHs='
          },
          {
            urls: 'turn:relay.metered.ca:443',
            username: 'f570aa13f1f8e73aa00c77f8',
            credential: 'aXd8V2yT6rU0lPhR'
          }
        ]
      },
      // Important: These options improve media compatibility
      objectMode: true,
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      sdpTransform: (sdp) => {
        // Optimize SDP for better compatibility
        return sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000');
      }      
    });
    // Handle signal events more robustly
    peer.on('signal', signal => {
      console.log('📤 Sending signal to', userToSignal, signal.type);
      socketRef.current.emit('signal', {
        roomId,
        to: userToSignal,
        from: callerID,
        signal
      });
    });
    
    peer.on('connect', () => {
      console.log('🔗 Connected to peer:', userToSignal);
    });
    
    peer.on('error', err => {
      console.error('⚠️ Peer error:', err);
    });
    
    peer.on('close', () => {
      console.log('❌ Peer connection closed with:', userToSignal);
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    console.log('Adding responder peer from:', callerID);
    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [
          // Multiple STUN servers for redundancy
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // Free TURN servers - very important for responder peers
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: '1070fef0748a27dcef18e16c8aa5649786dd9d91369fd02e35be3074f1d763eb',
            credential: '/uAc0y/EsXnG8P5gV7l37nbz5zsXXZWv1P3jYEGZgHs='
          },
          {
            urls: 'turn:relay.metered.ca:443',
            username: 'f570aa13f1f8e73aa00c77f8',
            credential: 'aXd8V2yT6rU0lPhR'
          }
        ]
      },
      // Important: These options improve media compatibility
      objectMode: true,
      answerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      sdpTransform: (sdp) => {
        // Optimize SDP for better compatibility
        return sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000');
      }
    });
    peer.on('signal', signal => {
      console.log('📤 Sending response signal to', callerID, signal.type);
      socketRef.current.emit('signal', {
        roomId,
        to: callerID,
        from: socketRef.current.id,
        signal
      });
    });
    
    peer.on('connect', () => {
      console.log('🔗 Connected to peer:', callerID);
    });
    
    peer.on('error', err => {
      console.error('⚠️ Peer error:', err);
    });
    
    peer.on('close', () => {
      console.log('❌ Peer connection closed with:', callerID);
    });
    peer.signal(incomingSignal);
    return peer;
  };

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (!storedUsername) {
      navigate('/');
      return;
    }
    setUsername(storedUsername);
    
    // Reset state for clean re-connects
    setPeers([]);
    peersRef.current = [];
    
    // Clean up any existing media tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Handle environment variables in a browser-safe way
    // For Create React App, environment variables are usually injected at build time
    // If we're getting 'process is not defined', we'll use a direct fallback approach
    let serverUrl;
    try {
      // Try to access process.env safely
      serverUrl = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SERVER_URL) 
        ? process.env.REACT_APP_SERVER_URL 
        : window.location.origin;
    } catch (err) {
      console.log('Environment variable access error, using fallback URL');
      // Fallback to a hardcoded development URL or the origin
      serverUrl = 'http://localhost:9000';
    }
    console.log('Connecting to server URL:', serverUrl);
    
    // Force websocket transport and increase reconnection attempts
    socketRef.current = io.connect(serverUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Improved media constraints for better compatibility
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    // Media access with more detailed error handling
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        console.log('Media access granted:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
        
        // Force enable all tracks explicitly
        stream.getTracks().forEach(track => {
          console.log(`Enabling track: ${track.kind} (${track.id})`);
          track.enabled = true;
        });
        
        setStream(stream);
        
        // Ensure video element is ready
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
          userVideo.current.muted = true; // Important: mute local video to prevent feedback
          userVideo.current.onloadedmetadata = () => {
            userVideo.current.play()
              .then(() => console.log('Local video playback started'))
              .catch(e => console.error('Error playing local video:', e));
          };
        }

      socketRef.current.emit('join-room', {
        roomId,
        userId: userId.current,
        username: storedUsername
      });

      socketRef.current.on('user-connected', ({ userId, username }) => {
        const peer = createPeer(userId, socketRef.current.id, stream);
        peersRef.current.push({ peerId: userId, peer, username });
        setPeers(prev => [...prev, { peerId: userId, peer, username }]);
      });

      // Handle incoming signals more robustly
      socketRef.current.on('signal', ({ from, signal }) => {
        console.log('🔄 Received signal from', from, signal.type);
        const existing = peersRef.current.find(p => p.peerId === from);
        if (existing) {
          try {
            existing.peer.signal(signal);
          } catch (err) {
            console.error('Error handling signal for existing peer:', err);
          }
        } else {
          try {
            const peer = addPeer(signal, from, stream);
            peersRef.current.push({ peerId: from, peer, username: 'User' });
            setPeers(prev => [...prev, { peerId: from, peer, username: 'User' }]);
          } catch (err) {
            console.error('Error creating new peer from signal:', err);
          }
        }
      });
      
      // Add handler for broadcast signals as a fallback
      socketRef.current.on('signal-broadcast', ({ from, signal }) => {
        if (from === userId.current) return; // Don't process our own broadcasts
        console.log('📢 Received broadcast signal from', from, signal.type);
        const existing = peersRef.current.find(p => p.peerId === from);
        if (existing) {
          try {
            existing.peer.signal(signal);
          } catch (err) {
            console.error('Error handling broadcast signal:', err);
          }
        }
      });

      socketRef.current.on('ice-candidate', ({ from, candidate }) => {
        console.log('🔥 Received ICE candidate from', from);
        const peerObj = peersRef.current.find(p => p.peerId === from);
        if (peerObj && peerObj.peer) {
          try {
            peerObj.peer.signal({ type: 'candidate', candidate });
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      });
      
      socketRef.current.on('ice-candidate-broadcast', ({ from, candidate }) => {
        if (from === userId.current) return;
        console.log('📡 Broadcast ICE candidate from', from);
        const peerObj = peersRef.current.find(p => p.peerId === from);
        if (peerObj && peerObj.peer) {
          try {
            peerObj.peer.signal({ type: 'candidate', candidate });
          } catch (err) {
            console.error('Error adding broadcast ICE candidate:', err);
          }
        }
      });

      socketRef.current.on('user-disconnected', ({ userId }) => {
        const peerObj = peersRef.current.find(p => p.peerId === userId);
        if (peerObj) peerObj.peer.destroy();
        peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
        setPeers(peers => peers.filter(p => p.peerId !== userId));
      });

      socketRef.current.on('room-participants', (roomParticipants) => {
        setParticipants(roomParticipants);
        const existingUsers = roomParticipants.filter(p => p.userId !== userId.current);
        existingUsers.forEach(({ userId: existingUserId, username }) => {
          const peer = createPeer(existingUserId, socketRef.current.id, stream);
          peersRef.current.push({ peerId: existingUserId, peer, username });
          setPeers(prev => [...prev, { peerId: existingUserId, peer, username }]);
        });
      });

      socketRef.current.on('new-message', ({ message, sender, timestamp, messageId }) => {
        const isDuplicate = messages.some(msg => msg.messageId === messageId);
        if (!isDuplicate) {
          const isMyMessage = sender === username;
          setMessages(prev => [...prev, { text: message, sender, isMe: isMyMessage, timestamp, messageId }]);
        }
      });

    }).catch(error => {
      console.error('Media error:', error);
      alert('Camera/mic permission required.');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (stream) stream.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(({ peer }) => peer.destroy());
    };
  }, [navigate, roomId]);

  const toggleAudio = () => {
    if (stream) {
      // Get all audio tracks and toggle them
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        console.log(`Toggling audio track: ${track.enabled ? 'OFF' : 'ON'}`);
        track.enabled = !audioEnabled;
      });
      
      // Log the actual enabled state of the tracks after toggling
      console.log('Audio tracks after toggle:', 
        audioTracks.map(t => `${t.label}: ${t.enabled ? 'enabled' : 'disabled'}`).join(', '));
      
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      // Get all video tracks and toggle them
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        console.log(`Toggling video track: ${track.enabled ? 'OFF' : 'ON'}`);
        track.enabled = !videoEnabled;
      });
      
      // Log the actual enabled state of the tracks after toggling
      console.log('Video tracks after toggle:', 
        videoTracks.map(t => `${t.label}: ${t.enabled ? 'enabled' : 'disabled'}`).join(', '));
      
      setVideoEnabled(!videoEnabled);
    }
  };

  const endCall = () => navigate('/');

  const sendMessage = (message) => {
    if (socketRef.current) {
      const messageId = `${socketRef.current.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      socketRef.current.emit('send-message', {
        roomId,
        message,
        sender: username,
        messageId
      });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard!');
  };

  return (
    <div className="room-container">
      <div className="room-info-bar">
        <div className="room-id">
          <strong>Room ID:</strong> {roomId} 
          <button onClick={copyRoomId} className="copy-btn" title="Copy room ID">
            <FaCopy />
          </button>
        </div>
        <div className="participants-count">
          <strong>Participants:</strong> {participants.length}
        </div>
      </div>

      <div className="video-container">
        <div className="video-item">
          <video ref={userVideo} muted autoPlay playsInline />
          <div className="user-name">{username} (You)</div>
        </div>
        {peers.map(p => (
          <Video key={p.peerId} peer={p.peer} username={p.username} />
        ))}
        {peers.length === 0 && (
          <div className="no-participants-message">
            <Alert variant="info">
              You're the only one here. Share the Room ID with others.
            </Alert>
          </div>
        )}
      </div>

      <div className="controls">
        <button className={`control-btn ${audioEnabled ? '' : 'mute'}`} onClick={toggleAudio}>
          {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        <button className={`control-btn ${videoEnabled ? '' : 'video-off'}`} onClick={toggleVideo}>
          {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
        <button className="control-btn end-call" onClick={endCall}>
          <FaPhoneSlash />
        </button>
        <button className="control-btn" onClick={() => setChatOpen(!chatOpen)}>
          <FaComments />
        </button>
      </div>

      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} messages={messages} onSendMessage={sendMessage} />
    </div>
  );
};

const Video = ({ peer, username }) => {
  const ref = useRef();
  
  useEffect(() => {
    // Debug the incoming peer connection
    console.log(`Setting up video for peer: ${username}`);
    
    // Create a MediaStream to hold remote tracks
    const remoteStream = new MediaStream();
    
    // Set up track event handlers
    peer.on('track', (track, stream) => {
      console.log(`🎥 Received remote ${track.kind} track from ${username}`);
      
      // Add this track to our remote stream
      remoteStream.addTrack(track);
      
      // Attach the stream to the video element
      if (ref.current) {
        ref.current.srcObject = remoteStream;
        
        // Handle video playback
        if (!ref.current.paused) {
          console.log('Video already playing, updating stream');  
        } else {
          console.log('Starting video playback with remote stream');
          ref.current.play()
            .then(() => console.log(`Remote video playback started for ${username}`))
            .catch(e => console.error(`Error playing remote video for ${username}:`, e));
        }
      }
    });
    
    // Backward compatibility for simple-peer versions that use 'stream' event
    peer.on('stream', stream => {
      console.log(`🎥 Received remote stream event from ${username}`);
      if (ref.current) {
        ref.current.srcObject = stream;
        ref.current.onloadedmetadata = () => {
          ref.current.play()
            .then(() => console.log(`Remote video playback started for ${username} (stream event)`))
            .catch(e => console.error(`Error playing remote video for ${username}:`, e));
        };
      }
    });
    
    // Clear event listeners on unmount
    return () => {
      peer.removeAllListeners('track');
      peer.removeAllListeners('stream');
    };
  }, [peer, username]);

  return (
    <div className="video-item">
      <video ref={ref} autoPlay playsInline />
      <div className="user-name">{username}</div>
    </div>
  );
};

export default Room;