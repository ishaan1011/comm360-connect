import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Alert, Container, Row, Col, Card } from 'react-bootstrap';
import { FaVideo, FaUsers, FaLock, FaGlobe, FaUserPlus, FaDoorOpen, FaRocket } from 'react-icons/fa';
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

  // Animation effect for features
  useEffect(() => {
    const features = document.querySelectorAll('.feature-card');
    features.forEach((feature, index) => {
      setTimeout(() => {
        feature.classList.add('animated');
      }, 300 * index);
    });
  }, []);

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="home-title">Comm360</h1>
        <p className="home-subtitle">Enterprise-grade communication platform.</p>
        
        <div className="floating-bubbles">
          <div className="bubble bubble-1"></div>
          <div className="bubble bubble-2"></div>
          <div className="bubble bubble-3"></div>
        </div>
      </div>

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
            <Button variant="primary" onClick={createRoom} size="lg" className="create-btn">
              <FaRocket className="me-2" /> Create New Meeting
            </Button>
            <Button variant="outline-primary" onClick={() => setJoinMode(true)} size="lg">
              <FaDoorOpen className="me-2" /> Join a Meeting
            </Button>
          </div>
          
          <Container className="features-section">
            <h2 className="section-title">Why Choose Comm360?</h2>
            <Row>
              <Col md={4}>
                <Card className="feature-card">
                  <Card.Body>
                    <div className="feature-icon"><FaVideo /></div>
                    <Card.Title>HD Video</Card.Title>
                    <Card.Text>Crystal clear video quality for all your meetings, even on slower networks.</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card">
                  <Card.Body>
                    <div className="feature-icon"><FaUsers /></div>
                    <Card.Title>Group Meetings</Card.Title>
                    <Card.Text>Connect with multiple participants in a seamless video conference.</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="feature-card">
                  <Card.Body>
                    <div className="feature-icon"><FaLock /></div>
                    <Card.Title>Secure</Card.Title>
                    <Card.Text>End-to-end encryption ensures your meetings stay private and secure.</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>
        </>
      ) : (
        <>
          <div className="join-form">
            <div className="join-header">
              <FaUserPlus className="join-icon" />
              <h3>Join an Existing Meeting</h3>
            </div>
            <Form.Group>
              <Form.Label>Your Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mb-3"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Meeting ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mb-3"
              />
            </Form.Group>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="join-actions">
              <Button variant="primary" onClick={joinRoom} size="lg" className="join-btn">
                <FaDoorOpen className="me-2" /> Join Meeting
              </Button>
              <Button variant="outline-secondary" onClick={() => setJoinMode(false)} size="lg">
                Back
              </Button>
            </div>
          </div>
        </>
      )}
      
      <footer className="home-footer">
        <Container>
          <Row>
            <Col md={6}>
              <h4><FaVideo className="me-2" /> Comm360</h4>
              <p>Complete communications solution for modern enterprises.</p>
            </Col>
            <Col md={6} className="text-end">
              <p>© 2025 Comm360. All rights reserved.</p>
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  );
};

export default Home;
