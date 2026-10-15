import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, CardActions, Button, Typography,
  TextField, Dialog, DialogContent, DialogTitle, DialogActions,
  Box, Chip, MenuItem, Select, InputLabel, FormControl,
  CircularProgress, IconButton, Divider, Switch, FormControlLabel,
  Alert, LinearProgress, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Tooltip,
} from '@mui/material';
import DownloadIcon    from '@mui/icons-material/Download';
import DeleteIcon      from '@mui/icons-material/Delete';
import VisibilityIcon  from '@mui/icons-material/Visibility';
import ShareIcon       from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon        from '@mui/icons-material/Lock';
import LockOpenIcon    from '@mui/icons-material/LockOpen';
import TimerIcon       from '@mui/icons-material/Timer';
import HistoryIcon     from '@mui/icons-material/History';
import WarningIcon     from '@mui/icons-material/Warning';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

// ── QR code via Google Chart API (no extra package needed) ────────────────────
function QRCode({ value, size = 160 }) {
  const url = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(value)}&choe=UTF-8`;
  return (
    <Box sx={{ textAlign: 'center', mt: 2 }}>
      <img src={url} alt="QR Code" width={size} height={size} style={{ border: '4px solid white', borderRadius: 8 }} />
      <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
        Scan with phone to open share link
      </Typography>
    </Box>
  );
}

// ── Action badge colours ───────────────────────────────────────────────────────
const ACTION_META = {
  UPLOAD:             { label: 'Uploaded',        color: 'primary' },
  DOWNLOAD:           { label: 'Downloaded',       color: 'success' },
  DOWNLOAD_SHARED:    { label: 'Shared Download',  color: 'success' },
  WRONG_KEY:          { label: 'Wrong Key',        color: 'warning' },
  SHARE_GENERATED:    { label: 'Link Created',     color: 'info' },
  SHARE_LINK_OPENED:  { label: 'Link Opened',      color: 'info' },
  DELETE:             { label: 'Deleted',          color: 'error' },
  BRUTE_FORCE_LOCKED: { label: 'Brute-Force Lock', color: 'error' },
};

function MyFiles() {
  const [files,          setFiles]          = useState([]);
  const [secretKey,      setSecretKey]      = useState('');
  const [downloadFileId, setDownloadFileId] = useState('');
  const [attemptsLeft,   setAttemptsLeft]   = useState(null);
  const [lockedSecs,     setLockedSecs]     = useState(0);
  const [countdown,      setCountdown]      = useState(0);
  const userId = localStorage.getItem('userId');

  // Preview
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [previewFile,    setPreviewFile]    = useState(null);
  const [previewData,    setPreviewData]    = useState(null);
  const [previewKey,     setPreviewKey]     = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Share
  const [shareOpen,     setShareOpen]     = useState(false);
  const [shareFile,     setShareFile]     = useState(null);
  const [shareDuration, setShareDuration] = useState('24h');
  const [oneTime,       setOneTime]       = useState(false);
  const [shareLink,     setShareLink]     = useState('');
  const [shareExpiry,   setShareExpiry]   = useState(null);
  const [shareLoading,  setShareLoading]  = useState(false);
  const [isOneTime,     setIsOneTime]     = useState(false);

  // Audit log
  const [auditOpen,   setAuditOpen]   = useState(false);
  const [auditLogs,   setAuditLogs]   = useState([]);
  const [auditLoading,setAuditLoading]= useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/files', { params: { userId } });
      setFiles(res.data);
    } catch (e) { if (e.response?.status !== 404) toast.error('Error fetching files.'); }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchFiles();
    else toast.error('User ID not found. Please log in again.');
  }, [userId, fetchFiles]);

  // Countdown timer for brute-force lock
  useEffect(() => {
    if (lockedSecs <= 0) return;
    setCountdown(lockedSecs);
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); setLockedSecs(0); setAttemptsLeft(null); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedSecs]);

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async (fileId) => {
    const file = files.find(f => f._id === fileId);
    if (!file)      { toast.error('File not found.');              return; }
    if (!secretKey) { toast.error('Please enter the secret key.'); return; }
    if (lockedSecs > 0) { toast.error(`File locked. Wait ${countdown}s.`); return; }

    try {
      const response = await axios.post(
        `http://localhost:5000/download/${file.filename}`,
        { secretKey, iv: file.iv },
        { responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', file.originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('File downloaded successfully!');
      setDownloadFileId(''); setSecretKey(''); setAttemptsLeft(null);
    } catch (error) {
      const data = error.response?.data;
      if (error.response?.status === 429) {
        setLockedSecs(data.lockedSeconds || 900);
        toast.error(data.error);
      } else if (error.response?.status === 403) {
        setAttemptsLeft(data.attemptsLeft);
        toast.error(data.error);
      } else {
        toast.error(data?.error || 'Download error.');
      }
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (fileId) => {
    if (!window.confirm('Delete this file permanently?')) return;
    try {
      await axios.delete(`http://localhost:5000/files/${fileId}`, { params: { userId } });
      toast.success('File deleted.');
      fetchFiles();
    } catch { toast.error('Error deleting file.'); }
  };

  // ── Preview ────────────────────────────────────────────────────────────────
  const openPreview = (file) => {
    setPreviewFile(file); setPreviewData(null); setPreviewKey(''); setPreviewOpen(true);
    loadPreview(file, '');
  };
  const loadPreview = async (file, key) => {
    setPreviewLoading(true);
    try {
      const res = await axios.post(`http://localhost:5000/preview/${file.filename}`, { secretKey: key });
      setPreviewData(res.data);
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'Wrong secret key for preview.' : err.response?.data?.error || 'Preview failed.');
    } finally { setPreviewLoading(false); }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const openShare = (file) => {
    setShareFile(file); setShareLink(''); setShareExpiry(null);
    setShareDuration('24h'); setOneTime(false); setIsOneTime(false); setShareOpen(true);
  };
  const handleGenerateLink = async () => {
    setShareLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/share', {
        userId, fileId: shareFile._id, shareDuration, oneTime,
      });
      setShareLink(res.data.shareLink);
      setShareExpiry(res.data.shareExpiresAt);
      setIsOneTime(res.data.oneTime);
      toast.success('Share link generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error generating link.');
    } finally { setShareLoading(false); }
  };
  const copyLink = () => navigator.clipboard.writeText(shareLink).then(() => toast.success('Link copied!')).catch(() => toast.error('Copy failed.'));

  // ── Audit log ──────────────────────────────────────────────────────────────
  const openAuditLog = async () => {
    setAuditOpen(true); setAuditLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/audit-log', { params: { userId } });
      setAuditLogs(res.data);
    } catch { toast.error('Error fetching audit log.'); }
    finally { setAuditLoading(false); }
  };

  // ── Expiry badge ──────────────────────────────────────────────────────────
  const ExpiryBadge = ({ expiresAt }) => {
    if (!expiresAt) return <Chip size="small" label="Never expires" color="success" />;
    const diff  = new Date(expiresAt) - new Date();
    if (diff <= 0) return <Chip size="small" label="Expired" color="error" />;
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(hours / 24);
    const label = days > 0 ? `Expires in ${days}d` : `Expires in ${hours}h`;
    return <Chip size="small" icon={<TimerIcon />} label={label} color={days < 1 ? 'error' : days < 2 ? 'warning' : 'info'} />;
  };

  return (
    <Box sx={{ mt: 2, padding: 2 }}>
      <ToastContainer />

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight="bold" color="#1976d2">Your Files</Typography>
        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={openAuditLog} size="small">
          View Audit Log
        </Button>
      </Box>

      {files.length === 0 && <Typography color="text.secondary">No files uploaded yet.</Typography>}

      <Grid container spacing={3}>
        {files.map((file) => (
          <Grid item xs={12} key={file._id}>
            <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" color="#1976d2">{file.originalName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Uploaded: {new Date(file.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <ExpiryBadge expiresAt={file.expiresAt} />
              </CardContent>
              <CardActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                <Button variant="outlined"   size="small" startIcon={<VisibilityIcon />} onClick={() => openPreview(file)} sx={{ textTransform: 'none' }}>Preview</Button>
                <Button variant="contained"  size="small" color="primary"   startIcon={<DownloadIcon />} onClick={() => { setDownloadFileId(file._id); setSecretKey(''); setAttemptsLeft(null); setLockedSecs(0); }} sx={{ textTransform: 'none' }}>Download</Button>
                <Button variant="outlined"   size="small" color="secondary" startIcon={<ShareIcon />}   onClick={() => openShare(file)} sx={{ textTransform: 'none' }}>Share Link</Button>
                <Button variant="contained"  size="small" color="error"     startIcon={<DeleteIcon />}  onClick={() => handleDelete(file._id)} sx={{ textTransform: 'none' }}>Delete</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ══ DOWNLOAD DIALOG (with brute-force feedback) ══════════════════════ */}
      <Dialog open={!!downloadFileId} onClose={() => { setDownloadFileId(''); setAttemptsLeft(null); setLockedSecs(0); }} fullWidth maxWidth="sm">
        <DialogTitle fontWeight="bold" color="#1976d2">🔑 Enter Secret Key to Download</DialogTitle>
        <DialogContent>
          {lockedSecs > 0 ? (
            <Box>
              <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 2 }}>
                <strong>File Locked!</strong> Too many wrong attempts.
              </Alert>
              <Box textAlign="center" py={2}>
                <Typography variant="h3" fontWeight="bold" color="error">{countdown}s</Typography>
                <Typography variant="body2" color="text.secondary">Retry available after lockout</Typography>
                <LinearProgress variant="determinate" value={(1 - countdown / (lockedSecs || 900)) * 100}
                  sx={{ mt: 2, height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { backgroundColor: '#f44336' } }} />
              </Box>
            </Box>
          ) : (
            <Box>
              {attemptsLeft !== null && attemptsLeft <= 3 && (
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  Wrong key! <strong>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</strong> before 15-minute lockout.
                </Alert>
              )}
              <TextField
                fullWidth autoFocus type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDownload(downloadFileId)}
                placeholder="Paste your secret key here"
                variant="outlined" margin="normal"
              />
              <Button fullWidth variant="contained" color="primary" onClick={() => handleDownload(downloadFileId)} sx={{ mt: 1 }}>
                Decrypt &amp; Download
              </Button>
              <Button fullWidth variant="outlined" color="secondary" onClick={() => { setDownloadFileId(''); setAttemptsLeft(null); }} sx={{ mt: 1 }}>
                Cancel
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ PREVIEW DIALOG ═══════════════════════════════════════════════════ */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight="bold" color="#1976d2">🔍 File Preview — {previewFile?.originalName}</DialogTitle>
        <DialogContent>
          {previewLoading && <Box textAlign="center" py={4}><CircularProgress /></Box>}
          {!previewLoading && previewData && (
            <Box>
              <Box mb={3}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <LockIcon color="error" />
                  <Typography variant="subtitle1" fontWeight="bold" color="error">Encrypted Ciphertext (stored on server)</Typography>
                </Box>
                <Box sx={{ background: '#1a1a2e', color: '#e94560', fontFamily: 'monospace', fontSize: '12px', p: 2, borderRadius: 2, overflowX: 'auto', wordBreak: 'break-all', lineHeight: 2 }}>
                  {previewData.encryptedHex}
                </Box>
                <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                  ↑ AES-256-CTR ciphertext — completely unreadable without the key.
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              {previewData.keyRequired ? (
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <LockOpenIcon color="success" />
                    <Typography variant="subtitle1" fontWeight="bold" color="success.main">Enter key to see decrypted content</Typography>
                  </Box>
                  <Box display="flex" gap={1}>
                    <TextField fullWidth size="small" value={previewKey} onChange={(e) => setPreviewKey(e.target.value)} placeholder="Paste your secret key" type="password" />
                    <Button variant="contained" color="success" onClick={() => loadPreview(previewFile, previewKey)}>Decrypt Preview</Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <LockOpenIcon color="success" />
                    <Typography variant="subtitle1" fontWeight="bold" color="success.main">Decrypted Plain Text</Typography>
                  </Box>
                  <Box sx={{ background: '#f0fff4', color: '#2d6a4f', fontFamily: 'monospace', fontSize: '13px', p: 2, borderRadius: 2, wordBreak: 'break-word', whiteSpace: 'pre-wrap', border: '1px solid #b7e4c7' }}>
                    {previewData.decryptedText}
                  </Box>
                  <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                    ↑ Shown temporarily — the file on disk remains encrypted at all times.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setPreviewOpen(false)} variant="outlined">Close</Button></DialogActions>
      </Dialog>

      {/* ══ SHARE DIALOG (with QR + one-time toggle) ═════════════════════════ */}
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight="bold" color="#1976d2">🔗 Share — {shareFile?.originalName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Recipient still needs the <strong>secret key</strong> to decrypt. Share the key separately.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Link expires in</InputLabel>
            <Select value={shareDuration} label="Link expires in" onChange={(e) => setShareDuration(e.target.value)}>
              <MenuItem value="2m">2 minutes</MenuItem>
              <MenuItem value="5m">5 minutes</MenuItem>
              <MenuItem value="1h">1 Hour</MenuItem>
              <MenuItem value="24h">24 Hours</MenuItem>
              <MenuItem value="7d">7 Days</MenuItem>
              <MenuItem value="30d">30 Days</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={oneTime} onChange={(e) => setOneTime(e.target.checked)} color="warning" />}
            label={
              <Box>
                <Typography variant="body2" fontWeight="bold">One-time download link</Typography>
                <Typography variant="caption" color="text.secondary">Link self-destructs after first download</Typography>
              </Box>
            }
            sx={{ mb: 2 }}
          />

          <Button fullWidth variant="contained" color="secondary"
            onClick={handleGenerateLink} disabled={shareLoading}
            startIcon={shareLoading ? <CircularProgress size={16} /> : <ShareIcon />}
          >
            {shareLoading ? 'Generating...' : 'Generate Link'}
          </Button>

          {shareLink && (
            <Box mt={3}>
              <Box display="flex" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                {isOneTime && <Chip size="small" label="One-Time Link" color="warning" icon={<WarningIcon />} />}
                {shareExpiry && <Chip size="small" icon={<TimerIcon />} color="info" label={`Expires: ${new Date(shareExpiry).toLocaleString()}`} />}
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField fullWidth size="small" value={shareLink} InputProps={{ readOnly: true }} />
                <Tooltip title="Copy link">
                  <IconButton onClick={copyLink} color="primary"><ContentCopyIcon /></IconButton>
                </Tooltip>
              </Box>
              {/* QR Code */}
              <QRCode value={shareLink} size={160} />
              <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningIcon />}>
                Never share the secret key in the same message as the link!
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setShareOpen(false)} variant="outlined">Close</Button></DialogActions>
      </Dialog>

      {/* ══ AUDIT LOG DIALOG ═════════════════════════════════════════════════ */}
      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle fontWeight="bold" color="#1976d2">📋 Access Audit Log</DialogTitle>
        <DialogContent>
          {auditLoading && <Box textAlign="center" py={4}><CircularProgress /></Box>}
          {!auditLoading && auditLogs.length === 0 && (
            <Typography color="text.secondary" textAlign="center" py={3}>No activity recorded yet.</Typography>
          )}
          {!auditLoading && auditLogs.length > 0 && (
            <Paper sx={{ overflow: 'auto', maxHeight: 480 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', background: '#e3f2fd' }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', background: '#e3f2fd' }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', background: '#e3f2fd' }}>File</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', background: '#e3f2fd' }}>IP Address</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', background: '#e3f2fd' }}>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLogs.map((log) => {
                    const meta = ACTION_META[log.action] || { label: log.action, color: 'default' };
                    return (
                      <TableRow key={log._id} sx={{ background: log.success === false ? '#fff8f8' : 'inherit' }}>
                        <TableCell sx={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Chip label={meta.label} color={meta.color} size="small" />
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.filename || '—'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>{log.ip}</TableCell>
                        <TableCell sx={{ fontSize: '12px', color: 'text.secondary' }}>{log.details || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setAuditOpen(false)} variant="outlined">Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default MyFiles;