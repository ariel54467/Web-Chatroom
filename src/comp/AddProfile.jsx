import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { ref as dbRef, get, update } from 'firebase/database';
import { updateEmail, updateProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../css/AddProfile.css';
import logo from '../assets/logonobg.png';

export const AddProfile = () => {
  const [userName, setuserName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNum, setphoneNum] = useState('');
  const [address, setAddress] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const nav = useNavigate();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setError('Please select an image smaller than 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoBase64(event.target.result);
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          nav('/signin');
          return;
        }

        const userRef = dbRef(db, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setuserName(data.userName || '');
          setEmail(data.email || '');
          setphoneNum(data.phoneNum || '');
          setAddress(data.address || '');

          if (data.photoBase64) {
            setPhotoBase64(data.photoBase64);
          } else if (data.photoURL && !data.photoURL.includes('googleusercontent.com')) {
            setPhotoBase64(data.photoURL);
          } else {
            setPhotoBase64('');
          }
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [nav]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate required fields
    if (!userName) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email');
      setLoading(false);
      return;
    }

    // Validate phone number (must be numeric)
    if (phoneNum && isNaN(phoneNum)) {
      setError('Phone number must be numeric');
      setLoading(false);
      return;
    }

    // Validate profile photo
    if (!photoBase64) {
      setError('Profile photo is required');
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      await updateProfile(user, {
        displayName: userName,
        photoURL: photoBase64 || null
      });

      await updateEmail(user, email);

      const updates = {
        userName,
        email,
        phoneNum: phoneNum || null,
        address: address || null,
        photoBase64: photoBase64 || null,
        profileComplete: true
      };

      await update(dbRef(db, `users/${user.uid}`), updates);

      setSuccess('Profile updated successfully!');
      setTimeout(() => nav('/chat'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  return (
    <div className="profile-wrapper">
      <img src={logo} alt="Logo" className="profile-logo" />

      <form onSubmit={handleSubmit} className="profile-card">
        <h2>Profile Settings</h2>
        <p className="subtext">Update your personal information</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="profile-photo-section">
          <div
            className="profile-photo-preview"
            onClick={() => fileInputRef.current.click()}
            style={{
              backgroundImage: photoBase64
                ? `url(${photoBase64})`
                : 'none',
              backgroundColor: !photoBase64 ? '#f0f0f0' : 'transparent'
            }}
          >
            {!photoBase64 && <span>Add Photo</span>}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="photo-upload-btn"
            onClick={() => fileInputRef.current.click()}
          >
            {photoBase64 ? 'Change Photo' : 'Upload Photo'}
          </button>
          {photoBase64 && (
            <button
              type="button"
              className="photo-remove-btn"
              onClick={() => setPhotoBase64('')}
            >
              Remove Photo
            </button>
          )}
        </div>

        <div className="form-group">
          <label>Display Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setuserName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            value={phoneNum}
            onChange={(e) => setphoneNum(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
            rows="3"
          />
        </div>

        <div className="button-group">
          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => nav('/chat')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
