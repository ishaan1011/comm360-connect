import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Container, Nav } from 'react-bootstrap';
import { FaVideo, FaQuestionCircle, FaGithub } from 'react-icons/fa';

const Navbar = () => {
  return (
    <BootstrapNavbar expand="lg" variant="dark" className="py-2">
      <Container>
        <Link to="/" className="navbar-brand">
          <FaVideo className="brand-icon" /> Comm360
        </Link>
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link href="#" className="nav-link">Features</Nav.Link>
            <Nav.Link href="#" className="nav-link">Pricing</Nav.Link>
            <Nav.Link href="#" className="nav-link"><FaQuestionCircle /> Help</Nav.Link>
            <Nav.Link href="https://github.com" target="_blank" className="nav-link"><FaGithub /> GitHub</Nav.Link>
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;
