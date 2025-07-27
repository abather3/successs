import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as CounterIcon
} from '@mui/icons-material';

interface Counter {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CounterManagement: React.FC = () => {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [counterName, setCounterName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounters();
  }, []);

  const fetchCounters = async () => {
    try {
      const response = await fetch('/api/admin/counters', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCounters(data);
      } else {
        setErrorMessage('Failed to fetch counters');
      }
    } catch (error) {
      console.error('Error fetching counters:', error);
      setErrorMessage('Error fetching counters');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (counter?: Counter) => {
    if (counter) {
      setEditingCounter(counter);
      setCounterName(counter.name);
    } else {
      setEditingCounter(null);
      setCounterName('');
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCounter(null);
    setCounterName('');
  };

  const handleSaveCounter = async () => {
    if (!counterName.trim()) {
      setErrorMessage('Counter name is required');
      return;
    }

    try {
      const method = editingCounter ? 'PUT' : 'POST';
      const url = editingCounter 
        ? `/api/admin/counters/${editingCounter.id}`
        : '/api/admin/counters';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          name: counterName.trim(),
          displayOrder: 0,
          isActive: true
        })
      });

      if (response.ok) {
        const message = editingCounter ? 'Counter updated successfully' : 'Counter created successfully';
        setSuccessMessage(message);
        handleCloseDialog();
        fetchCounters();
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Error saving counter');
      }
    } catch (error) {
      console.error('Error saving counter:', error);
      setErrorMessage('Error saving counter');
    }
  };

  const handleDeleteCounter = async (counter: Counter) => {
    if (!window.confirm(`Are you sure you want to delete counter "${counter.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/counters/${counter.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        setSuccessMessage('Counter deleted successfully');
        fetchCounters();
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Error deleting counter');
      }
    } catch (error) {
      console.error('Error deleting counter:', error);
      setErrorMessage('Error deleting counter');
    }
  };

  const handleToggleActive = async (counter: Counter) => {
    try {
      const response = await fetch(`/api/admin/counters/${counter.id}/toggle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        setSuccessMessage(`Counter ${counter.is_active ? 'deactivated' : 'activated'} successfully`);
        fetchCounters();
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Error toggling counter status');
      }
    } catch (error) {
      console.error('Error toggling counter status:', error);
      setErrorMessage('Error toggling counter status');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading counters...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Counter Management
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage service counters that appear on the display monitor. These counters are used to organize customer service flow.
      </Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => handleOpenDialog()}
        sx={{ mb: 3 }}
      >
        Add New Counter
      </Button>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Service Counters
          </Typography>
          
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Counter Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {counters.map((counter) => (
                  <TableRow key={counter.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CounterIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body1" fontWeight="medium">
                          {counter.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={counter.is_active ? 'Active' : 'Inactive'}
                        color={counter.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{new Date(counter.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(counter.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(counter)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <Button
                        size="small"
                        onClick={() => handleToggleActive(counter)}
                        color={counter.is_active ? 'warning' : 'success'}
                        sx={{ ml: 1 }}
                      >
                        {counter.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteCounter(counter)}
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {counters.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CounterIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No counters configured
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add your first service counter to get started
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Counter Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCounter ? 'Edit Counter' : 'Add New Counter'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Counter Name"
            value={counterName}
            onChange={(e) => setCounterName(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g., Counter 1, JA, Reception"
            helperText="Enter a name for this service counter"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveCounter} variant="contained">
            {editingCounter ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Messages */}
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
      >
        <Alert onClose={() => setErrorMessage('')} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CounterManagement;
