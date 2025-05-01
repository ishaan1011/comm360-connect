import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar as BootstrapNavbar, Container } from 'react-bootstrap';

const Navbar = () => {
  return (
    <BootstrapNavbar bg="light" expand="lg">
      <Container>
        <Link to="/" className="navbar-brand">
          SimpleZoom
        </Link>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;
