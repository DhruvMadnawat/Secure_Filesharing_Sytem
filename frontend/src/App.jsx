import { useState, useEffect } from 'react';
import './index.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  // Dashboard State
  const [files, setFiles] = useState([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareTargetId, setShareTargetId] = useState(null);

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin ? { email, password } : { username, email, password };
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Authentication failed');
      
      setToken(data.token);
      setUser(data);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setFiles([]);
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}/files/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setFiles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;

    setUploadMessage('Encrypting and uploading...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setUploadMessage('Upload secure & successful!');
        fetchFiles();
      } else {
        setUploadMessage(data.message || 'Upload failed');
      }
    } catch (err) {
      setUploadMessage(err.message);
    }
    setTimeout(() => setUploadMessage(''), 3000);
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const res = await fetch(`${API_URL}/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(err.message);
        return;
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async (e, fileId) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/files/share/${fileId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ targetEmail: shareEmail })
      });
      const data = await res.json();
      alert(data.message);
      setShareTargetId(null);
      setShareEmail('');
      fetchFiles();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {!token ? (
        <div className="glass-panel" style={{ maxWidth: '400px', margin: '10vh auto' }}>
          <h1 className="heading">SecureShare</h1>
          {error && <p style={{ color: 'var(--text-color)', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
          <form onSubmit={handleAuth}>
            {!isLogin && (
              <input type="text" placeholder="Username" className="input-field" value={username} onChange={e => setUsername(e.target.value)} required />
            )}
            <input type="email" placeholder="Email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="btn" style={{ width: '100%', marginBottom: '1rem' }}>
              {isLogin ? 'Login Securely' : 'Create Secure Profile'}
            </button>
          </form>
          <p style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--primary-color)' }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 className="heading" style={{ margin: 0 }}>Secure Dashboard</h1>
            <div>
              <span style={{ marginRight: '1rem' }}>Welcome, {user.username}</span>
              <button className="btn" onClick={logout} style={{ padding: '0.5rem 1rem' }}>Logout</button>
            </div>
          </div>

          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3>Upload Secure File (AES-256 Encrypted)</h3>
            <form onSubmit={handleFileUpload} style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input type="file" name="file" className="input-field" style={{ flex: 1, margin: 0 }} required />
              <button type="submit" className="btn">Upload & Encrypt</button>
            </form>
            {uploadMessage && <p style={{ marginTop: '1rem', color: 'var(--primary-color)' }}>{uploadMessage}</p>}
          </div>

          <div className="glass-panel">
            <h3>Your Files & Shared Access</h3>
            <div style={{ marginTop: '1rem' }}>
              {files.length === 0 ? <p>No files available.</p> : null}
              {files.map(f => (
                <div key={f._id} className="file-item">
                  <div>
                    <strong style={{ display: 'block', fontSize: '1.1rem' }}>{f.filename}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      Owner: {f.ownerId._id === user._id ? 'You' : f.ownerId.username} | 
                      Date: {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => handleDownload(f._id, f.filename)}>
                      Decrypt & Download
                    </button>
                    {f.ownerId._id === user._id && (
                      <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: 'rgba(242, 143, 59, 0.2)', border: '1px solid var(--secondary-color)', color: 'var(--text-color)' }} onClick={() => setShareTargetId(shareTargetId === f._id ? null : f._id)}>
                        Share
                      </button>
                    )}
                  </div>
                  
                  {shareTargetId === f._id && (
                    <div style={{ position: 'absolute', right: '2rem', marginTop: '3.5rem', background: '#FFD5C2', padding: '1rem', borderRadius: '8px', zIndex: 10, border: '1px solid var(--glass-border)' }}>
                      <form onSubmit={(e) => handleShare(e, f._id)} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="email" placeholder="User Email" className="input-field" style={{ margin: 0 }} value={shareEmail} onChange={e => setShareEmail(e.target.value)} required />
                        <button type="submit" className="btn" style={{ padding: '0.4rem 0.8rem' }}>Grant Access</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
