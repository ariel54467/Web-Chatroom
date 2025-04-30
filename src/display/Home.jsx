import { Link } from 'react-router-dom';
import '../css/Home.css';
import logo from '../assets/logo.png';

export const Home = () => {
  return (
    <div className="home-split">
 
    <div className="home-left">
    <video autoPlay loop muted className="background-video">
        <source src="/src/assets/bg.mp4" type="video/mp4" />
    </video>

    <div className="logo-center-wrapper">
        <img src={logo} alt="Logo" className="logo-centered" />
    </div>
    </div>


    <div className="home-right">
        <h1 className="home-title">Welcome to Chatroom</h1>
        <p className="home-desc">
          A beautiful chatroom app built with React and Firebase.<br />
          Login or create an account to start chatting with friends.
        </p>
        <Link to="/signin">
          <button className="home-button">Get Started</button>
        </Link>
      </div>
    </div>
  );
};
