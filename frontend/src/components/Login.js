import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  TextField, Button, Typography, Box,
  Grid, Card, CardContent, IconButton, InputAdornment,
} from '@mui/material';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../App';

function Login() {
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/login', { username, password });
      if (response.data.message === 'Login successful') {
        toast.success('Login successful! Redirecting to the dashboard...');
        login(response.data.userId);
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        toast.error(response.data.error || 'Invalid credentials');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error logging in. Please try again.');
    }
  };

  return (
    <Grid
      container justifyContent="center" alignItems="center"
      style={{
        height: '98vh', overflow: 'hidden',
        background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 100%)',
      }}
    >
      <ToastContainer />
      <Grid item xs={12} sm={8} md={6} lg={4}>
        <Card elevation={10} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
          <CardContent sx={{ background: '#fff', textAlign: 'center', py: 5, px: 4 }}>

            <Typography variant="h4" component="h1" color="primary" gutterBottom fontWeight="bold">
              Welcome Back to CyberEscape!
            </Typography>
            <Typography variant="body1" color="textSecondary" mb={4}>
              Please enter your credentials to continue.
            </Typography>

            <Box>
              {/* Username */}
              <TextField
                label="Username" variant="outlined" fullWidth margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#fffde7' } }}
              />

              {/* Password with 👁 eye toggle */}
              <TextField
                label="Password" variant="outlined" fullWidth margin="normal"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#fffde7' } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(prev => !prev)}
                        edge="end"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword
                          ? <VisibilityOffIcon sx={{ color: '#1976d2' }} />
                          : <VisibilityIcon   sx={{ color: '#1976d2' }} />
                        }
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                variant="contained" color="primary" fullWidth
                sx={{ mt: 2, py: 1.4, fontWeight: 'bold', fontSize: '16px', letterSpacing: 1 }}
                onClick={handleLogin}
              >
                LOGIN
              </Button>

              <Box textAlign="center" mt={2}>
                <Typography variant="body2">
                  Don't have an account?{' '}
                  <Button variant="text" color="primary" onClick={() => navigate('/register')}>
                    Register
                  </Button>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

export default Login;