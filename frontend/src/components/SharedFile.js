import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Chip, CircularProgress, Container, Alert, LinearProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import TimerIcon    from '@mui/icons-material/Timer';
import LockIcon     from '@mui/icons-material/Lock';
import WarningIcon  from '@mui/icons-material/Warning';
import { useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

// ── Helper: format seconds into readable string ──────────────────────────────
function formatTimeLeft(ms) {
  if (ms <= 0) return '0s';
  const totalSecs = Math.floor(ms / 1000);
  const days  = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  if (days  > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins  > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ── Urgency colour based on time left ────────────────────────────────────────
function urgencyColor(ms) {
  const mins = ms / 60000;
  if (mins <= 1)  return '#f44336'; // red   — under 1 min
  if (mins <= 10) return '#ff9800'; // orange — under 10 min
  if (mins <= 60) return '#1976d2'; // blue  — under 1 hour
  return '#4caf50';                  // green — more than 1 hour
}

function SharedFile() {
  const { token } = useParams();

  const [fileInfo,     setFileInfo]     = useState(null);
  const [secretKey,    setSecretKey]    = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [downloading,  setDownloading]  = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  // ── Brute-force lockout ───────────────────────────────────────────────────
  const [lockedSecs,  setLockedSecs]  = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  // ── Link expiry live countdown ────────────────────────────────────────────
  const [timeLeftMs,    setTimeLeftMs]    = useState(null); // ms until link expires
  const [totalDurationMs, setTotalDurationMs] = useState(null); // for progress bar
  const [linkExpired,   setLinkExpired]   = useState(false);
  const linkTimerRef = useRef(null);

  // Load file info on mount
  useEffect(() => {
    axios.get(`http://localhost:5000/shared/${token}`)
      .then(res => {
        setFileInfo(res.data);
        const expiresAt = new Date(res.data.shareExpiresAt).getTime();
        const now       = Date.now();
        const left      = expiresAt - now;
        setTimeLeftMs(left > 0 ? left : 0);
        setTotalDurationMs(left > 0 ? left : 1); // use initial value as 100%
      })
      .catch(err => setError(err.response?.data?.error || 'Invalid or expired link.'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Live countdown for link expiry ────────────────────────────────────────
  useEffect(() => {
    if (timeLeftMs === null) return;
    if (timeLeftMs <= 0) { setLinkExpired(true); return; }

    linkTimerRef.current = setInterval(() => {
      setTimeLeftMs(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(linkTimerRef.current);
          setLinkExpired(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(linkTimerRef.current);
  }, [timeLeftMs !== null]); // eslint-disable-line

  // ── Brute-force lockout countdown ─────────────────────────────────────────
  useEffect(() => {
    if (lockedSecs <= 0) return;
    setLockCountdown(lockedSecs);
    const id = setInterval(() => {
      setLockCountdown(c => {
        if (c <= 1) { clearInterval(id); setLockedSecs(0); setAttemptsLeft(null); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedSecs]);

  const handleDownload = async () => {
    if (!secretKey)    { toast.error('Please enter the secret key.'); return; }
    if (linkExpired)   { toast.error('This share link has expired.'); return; }
    if (lockedSecs > 0){ toast.error(`Try again in ${lockCountdown}s.`); return; }

    setDownloading(true);
    try {
      const response = await axios.post(
        `http://localhost:5000/shared/${token}/download`,
        { secretKey },
        { responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', fileInfo.originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('File downloaded and decrypted!');
      setAttemptsLeft(null);
      if (fileInfo.oneTime) {
        setError('This was a one-time link. It has now been destroyed.');
        setFileInfo(null);
        clearInterval(linkTimerRef.current);
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 429) {
        setLockedSecs(data.lockedSeconds || 900);
        toast.error(data.error);
      } else if (err.response?.status === 403) {
        setAttemptsLeft(data.attemptsLeft ?? null);
        toast.error(data?.error || 'Wrong key.');
      } else {
        toast.error(data?.error || 'Download failed.');
      }
    } finally {
      setDownloading(false);
    }
  };

  // ── Percent of time remaining (for progress bar) ──────────────────────────
  const pct = totalDurationMs > 0 ? Math.max(0, (timeLeftMs / totalDurationMs) * 100) : 0;
  const barColor = timeLeftMs !== null ? urgencyColor(timeLeftMs) : '#4caf50';
  const isUrgent = timeLeftMs !== null && timeLeftMs < 5 * 60 * 1000; // < 5 min

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <ToastContainer />

      {/* Header */}
      <Box textAlign="center" mb={4}>
        <LockIcon sx={{ fontSize: 52, color: '#1976d2' }} />
        <Typography variant="h4" fontWeight="bold" color="primary">CyberEscape</Typography>
        <Typography variant="body1" color="text.secondary">Secure Encrypted File Sharing</Typography>
      </Box>

      {loading && <Box textAlign="center"><CircularProgress /></Box>}

      {!loading && (linkExpired || error) && (
        <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h2" mb={1}>⏰</Typography>
            <Typography variant="h6" color="error" fontWeight="bold">
              {linkExpired ? 'This share link has expired.' : `❌ ${error}`}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              {linkExpired
                ? 'The sender will need to generate a new link.'
                : 'This link may have expired, already been used, or been deleted.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !linkExpired && !error && fileInfo && (
        <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={2}>
              📄 {fileInfo.originalName}
            </Typography>

            {/* ── Live countdown timer ──────────────────────────────────── */}
            {timeLeftMs !== null && (
              <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: `2px solid ${barColor}`,
                background: isUrgent ? '#fff8f8' : '#f8f9ff' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TimerIcon sx={{ color: barColor, fontSize: 20 }} />
                    <Typography variant="body2" fontWeight="bold" color={barColor}>
                      {isUrgent ? '⚠️ Link expiring soon!' : 'Link expires in:'}
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5" fontWeight="bold"
                    sx={{ color: barColor, fontFamily: 'monospace', letterSpacing: 1 }}
                  >
                    {formatTimeLeft(timeLeftMs)}
                  </Typography>
                </Box>
                {/* Progress bar — drains as time passes */}
                <LinearProgress
                  variant="determinate" value={pct}
                  sx={{
                    height: 8, borderRadius: 4,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: barColor,
                      borderRadius: 4,
                      transition: 'none', // smooth 1s tick looks odd, disable animation
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                  Expires at: {new Date(fileInfo.shareExpiresAt).toLocaleString()}
                </Typography>
              </Box>
            )}

            {/* One-time badge */}
            {fileInfo.oneTime && (
              <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                <strong>One-time link</strong> — this link will be destroyed after first download.
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" mb={2}>
              This file is encrypted. Enter the <strong>secret key</strong> provided by the sender to decrypt and download it.
            </Typography>

            {/* Brute-force lockout */}
            {lockedSecs > 0 ? (
              <Box textAlign="center" py={2}>
                <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  Too many wrong attempts. File locked.
                </Alert>
                <Typography variant="h3" fontWeight="bold" color="error" sx={{ fontFamily: 'monospace' }}>
                  {Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s
                </Typography>
                <Typography variant="body2" color="text.secondary">Time remaining before retry</Typography>
                <LinearProgress variant="determinate" value={(1 - lockCountdown / (lockedSecs || 900)) * 100}
                  sx={{ mt: 2, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { backgroundColor: '#f44336' } }} />
              </Box>
            ) : (
              <Box>
                {attemptsLeft !== null && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Wrong key! <strong>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</strong> before 15-min lockout.
                  </Alert>
                )}
                <TextField
                  fullWidth label="Secret Key" type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                  placeholder="Paste the secret key here"
                  margin="normal"
                />
                <Button
                  fullWidth variant="contained" color="primary" size="large"
                  onClick={handleDownload} disabled={downloading}
                  startIcon={downloading ? <CircularProgress size={18} /> : <DownloadIcon />}
                  sx={{ mt: 1 }}
                >
                  {downloading ? 'Decrypting & Downloading...' : 'Decrypt & Download'}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

export default SharedFile;