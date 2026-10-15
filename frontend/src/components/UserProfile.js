import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField,
  Button, Divider, Avatar, Chip, IconButton, InputAdornment,
} from '@mui/material';
import PersonIcon        from '@mui/icons-material/Person';
import LockIcon          from '@mui/icons-material/Lock';
import FolderIcon        from '@mui/icons-material/Folder';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { toast }         from 'react-toastify';
import axios             from 'axios';

// Reusable eye icon button for password fields
function EyeToggle({ show, onToggle }) {
  return (
    <InputAdornment position="end">
      <IconButton
        onClick={onToggle} edge="end" tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        sx={{ color: '#1976d2' }}
      >
        {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );
}

function UserProfile() {
  const userId = localStorage.getItem('userId');

  const [profile,    setProfile]    = useState(null);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading,    setLoading]    = useState(false);

  // Individual show/hide state for each password field
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/profile/${userId}`);
        setProfile(res.data);
      } catch (err) {
        toast.error('Error loading profile.');
      }
    };
    if (userId) fetchProfile();
  }, [userId]);

  const handleChangePassword = async () => {
    if (!currentPwd)           { toast.error('Enter current password.');                     return; }
    if (!newPwd)               { toast.error('Enter new password.');                         return; }
    if (newPwd.length < 6)     { toast.error('New password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match.');                 return; }

    setLoading(true);
    try {
      await axios.put(`http://localhost:5000/profile/${userId}/change-password`, {
        currentPassword: currentPwd,
        newPassword:     newPwd,
      });
      toast.success('Password changed successfully!');
      // Reset all fields and hide toggles
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error changing password.');
    } finally {
      setLoading(false);
    }
  };

  // Determine confirm field border colour
  const confirmSx = () => {
    if (!confirmPwd || !newPwd) return {};
    return confirmPwd === newPwd
      ? { '& .MuiOutlinedInput-root fieldset': { borderColor: '#4caf50', borderWidth: 2 } }
      : { '& .MuiOutlinedInput-root fieldset': { borderColor: '#f44336', borderWidth: 2 } };
  };

  return (
    <Box maxWidth={500} mx="auto" mt={2}>

      {/* ── Profile Info Card ─────────────────────────────────────────── */}
      <Card sx={{ borderRadius: 3, boxShadow: 2, mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: '#1976d2', width: 56, height: 56 }}>
              <PersonIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {profile?.username || '...'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Member since {profile ? new Date(profile.joinedAt).toLocaleDateString() : '...'}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          <Box display="flex" alignItems="center" gap={1} mt={1}>
            <FolderIcon color="primary" />
            <Typography variant="body1">
              Total files uploaded:&nbsp;
              <Chip label={profile?.fileCount ?? '...'} size="small" color="primary" />
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* ── Change Password Card ──────────────────────────────────────── */}
      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <LockIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Change Password</Typography>
          </Box>

          {/* Current Password */}
          <TextField
            fullWidth label="Current Password" margin="normal" size="small"
            type={showCurrent ? 'text' : 'password'}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            InputProps={{
              endAdornment: (
                <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(p => !p)} />
              ),
            }}
          />

          {/* New Password */}
          <TextField
            fullWidth label="New Password (min 6 chars)" margin="normal" size="small"
            type={showNew ? 'text' : 'password'}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            InputProps={{
              endAdornment: (
                <EyeToggle show={showNew} onToggle={() => setShowNew(p => !p)} />
              ),
            }}
          />

          {/* Confirm New Password */}
          <TextField
            fullWidth label="Confirm New Password" margin="normal" size="small"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
            sx={confirmSx()}
            InputProps={{
              endAdornment: (
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(p => !p)} />
              ),
            }}
          />

          {/* Live match indicator */}
          {confirmPwd && newPwd && (
            <Typography
              variant="caption"
              color={confirmPwd === newPwd ? 'success.main' : 'error'}
              sx={{ ml: 1, display: 'block', mt: 0.5 }}
            >
              {confirmPwd === newPwd ? '✓ Passwords match' : '✗ Passwords do not match'}
            </Typography>
          )}

          <Button
            fullWidth variant="contained" color="primary"
            onClick={handleChangePassword} disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Updating...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default UserProfile;