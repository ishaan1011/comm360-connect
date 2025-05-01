import React, { useState, useRef, useEffect } from 'react';
import { FaPaperPlane, FaTimes } from 'react-icons/fa';

const ChatPanel = ({ isOpen, onClose, messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className={`chat-container ${isOpen ? 'open' : ''}`}>
      <div className="chat-header">
        <h4>Chat</h4>
        <button onClick={onClose} className="close-btn">
          <FaTimes />
        </button>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">No messages yet</div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.isMe ? 'sent' : 'received'}`}>
              {!msg.isMe && <div className="sender-name">{msg.sender}</div>}
              <div className="message-text">{msg.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit">
          <FaPaperPlane />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
