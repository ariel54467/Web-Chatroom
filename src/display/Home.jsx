import { Link } from 'react-router-dom';
import '../css/Home.css';
import logo from '../assets/logo.png';
import bgVideo from '../assets/bg.mp4';

export const Home = () => {
  return (
    <div className="home-split">
 
 <div className="home-left">
  <div className="video-cube-wrapper">
    <video autoPlay loop muted className="background-video">
      <source src={bgVideo} type="video/mp4" />
    </video>

    <div className="scene">
      <div className="cube">
        <div className="face front"><img src={logo} alt="front" /></div>
        <div className="face back"><img src={logo} alt="back" /></div>
        <div className="face right"><img src={logo} alt="right" /></div>
        <div className="face left"><img src={logo} alt="left" /></div>
        <div className="face top"><img src={logo} alt="top" /></div>
        <div className="face bottom"><img src={logo} alt="bottom" /></div>
      </div>
    </div>
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
