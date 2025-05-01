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

  useEffect(() => {
    // Get username from session storage
    const storedUsername = sessionStorage.getItem('username');
    if (!storedUsername) {
      // Redirect to home if username is not set
      navigate('/');
      return;
    }
    setUsername(storedUsername);

    // Initialize socket connection
    const serverUrl = process.env.REACT_APP_SERVER_URL || window.location.origin;
    console.log('Connecting to socket server at:', serverUrl);
    
    socketRef.current = io.connect(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    // Handle socket connection events
    socketRef.current.on('connect', () => {
      console.log('Connected to socket server with ID:', socketRef.current.id);
    });
    
    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    socketRef.current.on('connect_timeout', () => {
      console.error('Socket connection timeout');
    });
    
    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected to socket server after ${attemptNumber} attempts`);
    });
    
    socketRef.current.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
    
    socketRef.current.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });
    
    console.log('Connecting to socket server at:', serverUrl);

    // Get media stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setStream(stream);
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }

        // Join the room
        socketRef.current.emit('join-room', {
          roomId,
          userId: userId.current,
          username: storedUsername
        });

        // Handle other users joining
        socketRef.current.on('user-connected', ({ userId, username }) => {
          console.log(`User connected: ${username} (${userId})`);
          // Create a peer for the new user
          const peer = createPeer(userId, socketRef.current.id, stream);
          
          peersRef.current.push({
            peerId: userId,
            peer,
            username
          });

          setPeers(prevPeers => [...prevPeers, {
            peerId: userId,
            peer,
            username
          }]);
        });

        // Handle incoming signals
        socketRef.current.on('signal', ({ from, signal }) => {
          console.log('Received direct signal from:', from);
          const item = peersRef.current.find(p => p.peerId === from);
          if (item) {
            try {
              item.peer.signal(signal);
            } catch (err) {
              console.error('Error processing signal:', err);
            }
          } else {
            console.log('Creating new peer from signal');
            // Create a new peer if it doesn't exist yet
            const peer = addPeer(signal, from, stream);
            peersRef.current.push({
              peerId: from,
              peer,
              username: 'User' // We don't know the username yet
            });

            setPeers(prevPeers => [...prevPeers, {
              peerId: from,
              peer,
              username: 'User'
            }]);
          }
        });
        
        // Also handle broadcast signals as fallback
        socketRef.current.on('signal-broadcast', ({ from, signal }) => {
          console.log('Received broadcast signal from:', from);
          // Skip if it's from ourselves
          if (from === userId.current) return;
          
          const item = peersRef.current.find(p => p.peerId === from);
          if (item) {
            try {
              item.peer.signal(signal);
            } catch (err) {
              console.error('Error processing broadcast signal:', err);
            }
          }
        });
        
        // Handle ICE candidates
        socketRef.current.on('ice-candidate', ({ from, candidate }) => {
          console.log('Received ICE candidate from:', from);
          const item = peersRef.current.find(p => p.peerId === from);
          if (item && item.peer) {
            try {
              item.peer.signal({ type: 'candidate', candidate });
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        });
        
        // Also handle broadcast ICE candidates as fallback
        socketRef.current.on('ice-candidate-broadcast', ({ from, candidate }) => {
          console.log('Received broadcast ICE candidate from:', from);
          // Skip if it's from ourselves
          if (from === userId.current) return;
          
          const item = peersRef.current.find(p => p.peerId === from);
          if (item && item.peer) {
            try {
              item.peer.signal({ type: 'candidate', candidate });
            } catch (err) {
              console.error('Error adding broadcast ICE candidate:', err);
            }
          }
        });
        
        // Handle connection testing
        socketRef.current.on('user-ping', ({ from }) => {
          console.log('Received ping from:', from);
          socketRef.current.emit('pong-user', {
            roomId,
            to: from
          });
        });
        
        socketRef.current.on('user-pong', ({ from }) => {
          console.log('Received pong from:', from);
        });

        // Handle users disconnecting
        socketRef.current.on('user-disconnected', ({ userId }) => {
          console.log('User disconnected:', userId);
          const peerObj = peersRef.current.find(p => p.peerId === userId);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
          setPeers(peers => peers.filter(p => p.peerId !== userId));
        });

        // Receive room participants
        socketRef.current.on('room-participants', (roomParticipants) => {
          console.log('Room participants:', roomParticipants);
          setParticipants(roomParticipants);
          
          // Create peers for existing users
          const existingUsers = roomParticipants.filter(p => p.userId !== userId.current);
          existingUsers.forEach(({ userId: existingUserId, username }) => {
            const peer = createPeer(existingUserId, socketRef.current.id, stream);
            
            peersRef.current.push({
              peerId: existingUserId,
              peer,
              username
            });

            setPeers(prevPeers => [...prevPeers, {
              peerId: existingUserId,
              peer,
              username
            }]);
          });
        });

        // Handle incoming chat messages
        socketRef.current.on('new-message', ({ message, sender, timestamp }) => {
          console.log(`Received chat message from ${sender}: ${message.substring(0, 20)}${message.length > 20 ? '...' : ''}`);
          setMessages(prevMessages => {
            // Check if we already have this message (to avoid duplicates)
            const isDuplicate = prevMessages.some(msg => 
              msg.sender === sender && 
              msg.text === message && 
              (msg.timestamp === timestamp || Math.abs(msg.timestamp - timestamp) < 1000)
            );
            
            if (isDuplicate) {
              return prevMessages;
            }
            
            return [...prevMessages, { 
              text: message, 
              sender, 
              isMe: sender === username,
              timestamp: timestamp || Date.now()
            }];
          });
        });
        
        // Request message history when joining a room
        socketRef.current.emit('get-message-history', { roomId });
        
        // Handle message history
        socketRef.current.on('message-history', ({ messages: historyMessages }) => {
          console.log(`Received message history with ${historyMessages.length} messages`);
          
          if (historyMessages && historyMessages.length > 0) {
            setMessages(historyMessages.map(msg => ({
              text: msg.message,
              sender: msg.sender,
              isMe: msg.sender === username,
              timestamp: msg.timestamp
            })));
          }
        });
      })
      .catch(error => {
        console.error('Error accessing media devices:', error);
        alert('Error accessing camera or microphone. Please ensure you have granted the necessary permissions.');
      });

    // Cleanup on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
      peersRef.current.forEach(({ peer }) => {
        peer.destroy();
      });
    };
  }, [navigate, roomId]);

  // Function to create a peer
  const createPeer = (userToSignal, callerID, stream) => {
    console.log(`Creating peer connection to ${userToSignal}`);
    
    // Use public STUN servers and free TURN servers
    const peer = new Peer({
      initiator: true,
      trickle: true, // Enable trickle ICE for better connectivity
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Free TURN server from Twilio (you would normally implement your own TURN server or use a service)
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
            credential: 'w1uxM55V9yVoqyVFjt+mxDBV0F87AUCemaYVQGxsPLw='
          }
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Signaling to peer:', userToSignal);
      socketRef.current.emit('signal', {
        roomId,
        to: userToSignal,
        from: callerID,
        signal,
      });
    });
    
    peer.on('ice', candidate => {
      socketRef.current.emit('ice-candidate', {
        roomId,
        to: userToSignal,
        candidate,
      });
    });

    return peer;
  };

  // Function to handle a received signal
  const addPeer = (incomingSignal, callerID, stream) => {
    console.log(`Adding peer connection from ${callerID}`);
    
    // Use public STUN servers and free TURN servers
    const peer = new Peer({
      initiator: false,
      trickle: true, // Enable trickle ICE for better connectivity
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Free TURN server from Twilio (you would normally implement your own TURN server or use a service)
          {
            urls: 'turn:global.turn.twilio.com:3478?transport=udp',
            username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
            credential: 'w1uxM55V9yVoqyVFjt+mxDBV0F87AUCemaYVQGxsPLw='
          }
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Responding to signal from:', callerID);
      socketRef.current.emit('signal', {
        roomId,
        to: callerID,
        from: socketRef.current.id,
        signal,
      });
    });
    
    peer.on('ice', candidate => {
      socketRef.current.emit('ice-candidate', {
        roomId,
        to: callerID,
        candidate,
      });
    });

    peer.signal(incomingSignal);

    return peer;
  };

  // Toggle audio
  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  // End call and return to home
  const endCall = () => {
    navigate('/');
  };

  // Send a chat message
  const sendMessage = (message) => {
    if (socketRef.current) {
      socketRef.current.emit('send-message', {
        roomId,
        message,
        sender: username
      });
      
      // Add message to local state
      setMessages(prevMessages => [...prevMessages, { text: message, sender: username, isMe: true }]);
    }
  };

  // Copy room ID to clipboard
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard!'); 
  };

  return (
    <div className="room-container">
      {/* Room info and sharing */}
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
        {/* Local video */}
        <div className="video-item">
          <video ref={userVideo} muted autoPlay playsInline />
          <div className="user-name">{username} (You)</div>
        </div>
        
        {/* Remote video streams */}
        {peers.map((peer, index) => (
          <Video key={peer.peerId} peer={peer.peer} username={peer.username} />
        ))}
        
        {peers.length === 0 && (
          <div className="no-participants-message">
            <Alert variant="info">
              You're the only one here. Share the Room ID with others to invite them to join.
            </Alert>
          </div>
        )}
      </div>
      
      {/* Control buttons */}
      <div className="controls">
        <button 
          className={`control-btn ${audioEnabled ? '' : 'mute'}`} 
          onClick={toggleAudio}
        >
          {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        
        <button 
          className={`control-btn ${videoEnabled ? '' : 'video-off'}`} 
          onClick={toggleVideo}
        >
          {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>
        
        <button className="control-btn end-call" onClick={endCall}>
          <FaPhoneSlash />
        </button>
        
        <button className="control-btn" onClick={() => setChatOpen(!chatOpen)}>
          <FaComments />
        </button>
      </div>
      
      {/* Chat panel */}
      <ChatPanel 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
        messages={messages}
        onSendMessage={sendMessage}
      />
    </div>
  );
};

// Video component for remote peers
const Video = ({ peer, username }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      console.log('Received stream from peer');
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
    
    peer.on('error', err => {
      console.error('Peer connection error:', err);
    });
    
    peer.on('close', () => {
      console.log('Peer connection closed');
    });
  }, [peer]);

  return (
    <div className="video-item">
      <video ref={ref} autoPlay playsInline controls />
      <div className="user-name">{username}</div>
    </div>
  );
};

export default Room;
