import React, { useState } from 'react';
import {
  AppBar, Tabs, Tab, Typography, Button, Box,
  Container, Toolbar, Dialog, DialogContent,
  DialogTitle, TextField,
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ListIcon       from '@mui/icons-material/List';
import KeyIcon        from '@mui/icons-material/VpnKey';
import PersonIcon     from '@mui/icons-material/Person';
import UploadFile     from './UploadFile';
import MyFiles        from './MyFiles';
import UserProfile    from './UserProfile';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../App';
import axios           from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Dashboard() {
  const [tab, setTab] = useState(0);
  const { logout }    = useAuth();
  const navigate      = useNavigate();

  // Unlock File dialog
  const [unlockOpen,   setUnlockOpen]   = useState(false);
  const [secretKey,    setSecretKey]    = useState('');
  const [fileDetails,  setFileDetails]  = useState(null);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleVerifyKey = async () => {
    try {
      const response = await axios.post('http://localhost:5000/verify-key', { secretKey });
      setFileDetails(response.data);
      toast.success('File found! You can now download it.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid secret key.');
    }
  };

  const handleDownloadUnlocked = async () => {
    if (!fileDetails) return;
    try {
      const response = await axios.post(
        `http://localhost:5000/download/${fileDetails.filename}`,
        { secretKey, iv: fileDetails.iv },
        { responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', fileDetails.originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('File downloaded!');
      setUnlockOpen(false);
      setSecretKey('');
      setFileDetails(null);
    } catch {
      toast.error('Download failed. Please try again.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 5, py: 4, px: 3, backgroundColor: '#f5f5f5', borderRadius: '10px', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)' }}>
      <ToastContainer />

      <AppBar position="static" sx={{ backgroundColor: '#1565C0', borderRadius: '8px 8px 0 0' }} elevation={2}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, color: '#fff' }}>
            🔐 CyberEscape
          </Typography>
          <Button variant="outlined" color="inherit" onClick={handleLogout}
            sx={{ borderColor: '#fff', color: '#fff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' } }}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Tabs
        value={tab} onChange={(e, v) => setTab(v)} centered
        textColor="primary" indicatorColor="primary"
        sx={{ backgroundColor: '#fff', borderRadius: '0 0 8px 8px', boxShadow: '0px 2px 6px rgba(0,0,0,0.1)' }}
      >
        <Tab icon={<FileUploadIcon />} label="Upload File" />
        <Tab icon={<ListIcon />}       label="My Files" />
        <Tab icon={<KeyIcon />}        label="Unlock File" />
        <Tab icon={<PersonIcon />}     label="Profile" />
      </Tabs>

      <Box sx={{ mt: 4 }}>
        {tab === 0 && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ color: '#1565C0', fontWeight: 'bold' }}>
              Upload &amp; Encrypt a File
            </Typography>
            <UploadFile />
          </Box>
        )}
        {tab === 1 && <MyFiles />}
        {tab === 2 && (
          <Box textAlign="center">
            <Typography variant="h5" gutterBottom sx={{ color: '#1565C0', fontWeight: 'bold' }}>
              Unlock a File with Secret Key
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Have a secret key from someone? Enter it here to find and download the file.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => setUnlockOpen(true)}>
              Enter Secret Key
            </Button>
          </Box>
        )}
        {tab === 3 && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ color: '#1565C0', fontWeight: 'bold' }}>
              My Profile
            </Typography>
            <UserProfile />
          </Box>
        )}
      </Box>

      {/* Unlock Dialog */}
      <Dialog open={unlockOpen} onClose={() => { setUnlockOpen(false); setFileDetails(null); setSecretKey(''); }} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1565C0' }}>🔑 Enter Secret Key</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth autoFocus
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="Paste the secret key"
            variant="outlined" margin="normal" type="password"
          />
          {fileDetails && (
            <Typography sx={{ mt: 1 }} color="success.main">
              ✅ File found: <strong>{fileDetails.originalName}</strong>
            </Typography>
          )}
          <Button fullWidth variant="contained" color="primary" sx={{ mt: 2 }}
            onClick={!fileDetails ? handleVerifyKey : handleDownloadUnlocked}>
            {!fileDetails ? 'Find File' : 'Download & Decrypt'}
          </Button>
          <Button fullWidth variant="outlined" color="secondary" sx={{ mt: 1 }}
            onClick={() => { setUnlockOpen(false); setFileDetails(null); setSecretKey(''); }}>
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

export default Dashboard;