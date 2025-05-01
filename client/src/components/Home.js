import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Alert } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const Home = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinMode, setJoinMode] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!username) {
      setError('Please enter your name');
      return;
    }

    try {
      // Use direct UUID creation instead of API call for simplicity
      const newRoomId = uuidv4();
      
      // Store username in session storage
      sessionStorage.setItem('username', username);
      
      // Navigate to the new room
      navigate(`/room/${newRoomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Failed to create room. Please try again.');
    }
  };

  const joinRoom = () => {
    if (!username) {
      setError('Please enter your name');
      return;
    }

    if (!roomId) {
      setError('Please enter a room ID');
      return;
    }

    // Store username in session storage
    sessionStorage.setItem('username', username);
    // Navigate to the room
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="home-container">
      <h1 className="home-title">SimpleZoom</h1>
      <p>A simple video conferencing platform</p>

      {!joinMode ? (
        <>
          <div className="home-buttons">
            <Form.Group>
              <Form.Control
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mb-3"
              />
            </Form.Group>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button variant="primary" onClick={createRoom} size="lg">
              Create New Meeting
            </Button>
            <Button variant="outline-primary" onClick={() => setJoinMode(true)} size="lg">
              Join a Meeting
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="join-form">
            <Form.Group>
              <Form.Control
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mb-3"
              />
            </Form.Group>
            <Form.Group>
              <Form.Control
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mb-3"
              />
            </Form.Group>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button variant="primary" onClick={joinRoom} size="lg">
              Join Meeting
            </Button>
            <Button variant="outline-secondary" onClick={() => setJoinMode(false)} size="lg">
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
