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

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (!storedUsername) {
      navigate('/');
      return;
    }
    setUsername(storedUsername);

    const serverUrl = process.env.REACT_APP_SERVER_URL || window.location.origin;
    socketRef.current = io.connect(serverUrl);

    const constraints = {
      video: true,
      audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      setStream(stream);
      if (userVideo.current) userVideo.current.srcObject = stream;

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

      socketRef.current.on('signal', ({ from, signal }) => {
        const existing = peersRef.current.find(p => p.peerId === from);
        if (existing) {
          existing.peer.signal(signal);
        } else {
          const peer = addPeer(signal, from, stream);
          peersRef.current.push({ peerId: from, peer, username: 'User' });
          setPeers(prev => [...prev, { peerId: from, peer, username: 'User' }]);
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

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    });
    peer.on('signal', signal => {
      socketRef.current.emit('signal', {
        roomId,
        to: userToSignal,
        from: callerID,
        signal
      });
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    });
    peer.on('signal', signal => {
      socketRef.current.emit('signal', {
        roomId,
        to: callerID,
        from: socketRef.current.id,
        signal
      });
    });
    peer.signal(incomingSignal);
    return peer;
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(t => t.enabled = !audioEnabled);
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(t => t.enabled = !videoEnabled);
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
    peer.on('stream', stream => {
      if (ref.current) ref.current.srcObject = stream;
    });
    return () => peer.removeAllListeners('stream');
  }, [peer]);

  return (
    <div className="video-item">
      <video ref={ref} autoPlay playsInline />
      <div className="user-name">{username}</div>
    </div>
  );
};

export default Room;