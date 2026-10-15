import React, { useState } from 'react';
import {
  Box, Button, Typography, Dialog, DialogContent, DialogTitle,
  IconButton, MenuItem, Select, InputLabel, FormControl, Chip,
  Stepper, Step, StepLabel, TextField, LinearProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TimerIcon       from '@mui/icons-material/Timer';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

const STEPS = [
  { label: 'Reading file',        detail: 'Loading file into memory...' },
  { label: 'Generating AES key',  detail: 'Creating 256-bit random secret key...' },
  { label: 'Encrypting data',     detail: 'Running AES-256-CTR cipher on file bytes...' },
  { label: 'Uploading to server', detail: 'Sending encrypted ciphertext...' },
  { label: 'Complete',            detail: 'File is securely encrypted and stored!' },
];

function UploadFile() {
  const [file,          setFile]          = useState(null);
  const [fileName,      setFileName]      = useState('');
  const [expiresIn,     setExpiresIn]     = useState('2m');
  const [secretKey,     setSecretKey]     = useState('');
  const [expiresAt,     setExpiresAt]     = useState(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [activeStep,    setActiveStep]    = useState(-1);
  const [progress,      setProgress]      = useState(0);

  const userId = localStorage.getItem('userId');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f || null);
    setFileName(f ? f.name : '');
  };

  const animateSteps = () =>
    new Promise((resolve) => {
      const delays = [350, 550, 750, 0];
      let step = 0;
      const next = () => {
        setActiveStep(step);
        setProgress(Math.round(((step + 1) / STEPS.length) * 100));
        step++;
        if (step < STEPS.length - 1) setTimeout(next, delays[step - 1]);
        else resolve();
      };
      next();
    });

  const handleUpload = async () => {
    if (!file)   { toast.error('Please select a file.');             return; }
    if (!userId) { toast.error('User ID not found. Please log in.'); return; }

    setUploading(true);
    setActiveStep(0);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('expiresIn', expiresIn);

    try {
      const [, response] = await Promise.all([
        animateSteps(),
        axios.post('http://localhost:5000/upload', formData),
      ]);

      setActiveStep(STEPS.length - 1);
      setProgress(100);
      await new Promise(r => setTimeout(r, 700));

      setSecretKey(response.data.secretKey);
      setExpiresAt(response.data.expiresAt);
      setFile(null);
      setFileName('');
      setUploading(false);
      setActiveStep(-1);
      setShowKeyDialog(true);
    } catch (error) {

  console.log("FULL ERROR:", error);

  if (error.response) {
    console.log("Backend Response:", error.response.data);
    console.log("Status Code:", error.response.status);
  }

  if (error.request) {
    console.log("No response received from backend");
  }

  console.log("Error Message:", error.message);

  setUploading(false);
  setActiveStep(-1);

  toast.error(
    error.response?.data?.error ||
    error.message ||
    'Error uploading file.'
  );
}
  };

  const copyToClipboard = () =>
    navigator.clipboard.writeText(secretKey)
      .then(() => toast.success('Secret key copied!'))
      .catch(() => toast.error('Failed to copy.'));

  return (
    <Box textAlign="center" sx={{ px: 2 }}>
      <ToastContainer />

      <Box display="flex" justifyContent="center" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <input type="file" onChange={handleFileChange} style={{ display: 'none' }} id="file-upload" disabled={uploading} />
        <label htmlFor="file-upload">
          <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} disabled={uploading}>
            Select File
          </Button>
        </label>
        <Typography color={fileName ? 'text.primary' : 'text.secondary'}>
          {fileName || 'No file selected'}
        </Typography>
      </Box>

      <Box display="flex" justifyContent="center" mb={3}>
        <FormControl sx={{ minWidth: 220 }} disabled={uploading}>
          <InputLabel>File Expiry</InputLabel>
          <Select value={expiresIn} label="File Expiry" onChange={(e) => setExpiresIn(e.target.value)}>
            <MenuItem value="never">Never expires</MenuItem>
            <MenuItem value="2m">2 minutes</MenuItem>
            <MenuItem value="5m">5 minutes</MenuItem>
            <MenuItem value="1h">1 Hour</MenuItem>
            <MenuItem value="24h">24 Hours</MenuItem>
            <MenuItem value="7d">7 Days</MenuItem>
            <MenuItem value="30d">30 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Button
        variant="contained" color="primary" size="large"
        onClick={handleUpload} disabled={uploading || !file}
        startIcon={<CloudUploadIcon />}
      >
        {uploading ? 'Encrypting...' : 'Upload & Encrypt'}
      </Button>

      {/* ── Encryption Progress ─────────────────────────────────────────────── */}
      {uploading && (
        <Box sx={{ mt: 4, mx: 'auto', maxWidth: 520, textAlign: 'left', p: 3, border: '1px solid #e0e0e0', borderRadius: 3, background: '#fafafa' }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1} color="#1976d2">
            🔒 Encrypting your file...
          </Typography>
          <LinearProgress
            variant="determinate" value={progress}
            sx={{ height: 10, borderRadius: 5, mb: 3,
              backgroundColor: '#e3f2fd',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #1976d2, #42a5f5)', borderRadius: 5 },
            }}
          />
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ pl: 0 }}>
            {STEPS.map((step, index) => {
              const done    = index < activeStep;
              const current = index === activeStep;
              return (
                <Step key={step.label} completed={done}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        color: done ? '#4caf50 !important' : current ? '#1976d2 !important' : '#bdbdbd !important',
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={current ? 'bold' : 'normal'}
                      color={done ? '#4caf50' : current ? '#1976d2' : 'text.disabled'}
                    >
                      {step.label} {done && '✓'}
                    </Typography>
                    {current && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {step.detail}
                      </Typography>
                    )}
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>
        </Box>
      )}

      {/* ── Key Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={showKeyDialog} onClose={() => setShowKeyDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          🔐 File Encrypted Successfully
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Save this secret key. You need it to download and decrypt your file.
          </Typography>
          {expiresAt
            ? <Chip icon={<TimerIcon />} label={`Auto-deletes: ${new Date(expiresAt).toLocaleString()}`} color="warning" sx={{ my: 1 }} />
            : <Chip label="This file never expires" color="success" sx={{ my: 1 }} />
          }
          <Box display="flex" alignItems="center" mt={2}>
            <TextField fullWidth value={secretKey} InputProps={{ readOnly: true }} label="Your Secret Key" />
            <IconButton color="primary" onClick={copyToClipboard} sx={{ ml: 1 }}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
          <Button fullWidth variant="outlined" color="secondary" sx={{ mt: 2 }} onClick={() => setShowKeyDialog(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default UploadFile;