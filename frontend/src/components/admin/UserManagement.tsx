import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'sales' | 'cashier';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface NewUser {
  fullName: string;
  email: string;
  role: 'sales' | 'cashier';
}

interface UserDependencies {
  salesTransactions: number;
  cashierTransactions: number;
  canDelete: boolean;
  warnings: string[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<NewUser>({
    fullName: '',
    email: '',
    role: 'sales'
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null as User | null,
    dependencies: null as UserDependencies | null,
    loading: false
  });

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/users?excludeRole=admin', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch users',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.full_name,
        email: user.email,
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({
        fullName: '',
        email: '',
        role: 'sales'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      fullName: '',
      email: '',
      role: 'sales'
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = editingUser 
        ? `/api/users/${editingUser.id}` 
        : '/api/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: editingUser ? 'User updated successfully' : 'User created successfully',
          severity: 'success'
        });
        handleCloseDialog();
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save user',
        severity: 'error'
      });
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const token = localStorage.getItem('accessToken');
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: user.full_name,
          role: user.role,
          status: newStatus
        })
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
          severity: 'success'
        });
        fetchUsers();
      } else {
        throw new Error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update user status',
        severity: 'error'
      });
    }
  };

  const handleResetPassword = async (user: User) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: `Password reset email sent to ${user.email}`,
          severity: 'success'
        });
      } else {
        throw new Error('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setSnackbar({
        open: true,
        message: 'Failed to reset password',
        severity: 'error'
      });
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  const getRoleColor = (role: string) => {
    return role === 'sales' ? 'primary' : 'secondary';
  };

  const handleOpenDeleteDialog = async (user: User) => {
    setDeleteDialog({
      open: true,
      user,
      dependencies: null,
      loading: true
    });

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/users/${user.id}/dependencies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const dependencies = await response.json();
        setDeleteDialog(prev => ({ ...prev, dependencies, loading: false }));
      } else {
        throw new Error('Failed to check user dependencies');
      }
    } catch (error) {
      console.error('Error checking dependencies:', error);
      setSnackbar({
        open: true,
        message: 'Failed to check user dependencies',
        severity: 'error'
      });
      setDeleteDialog({ open: false, user: null, dependencies: null, loading: false });
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, user: null, dependencies: null, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.user) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/users/${deleteDialog.user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: `User ${deleteDialog.user.full_name} deleted successfully`,
          severity: 'success'
        });
        handleCloseDeleteDialog();
        fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to delete user',
        severity: 'error'
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading users...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" gutterBottom>
          User Management
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchUsers}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => handleOpenDialog()}
          >
            Add New User
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Full Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role.toUpperCase()} 
                    color={getRoleColor(user.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={user.status.toUpperCase()} 
                    color={getStatusColor(user.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleOpenDialog(user)}
                    color="primary"
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleToggleStatus(user)}
                    color={user.status === 'active' ? 'error' : 'success'}
                    size="small"
                  >
                    {user.status === 'active' ? <LockIcon /> : <LockOpenIcon />}
                  </IconButton>
                  <IconButton
                    onClick={() => handleResetPassword(user)}
                    color="warning"
                    size="small"
                  >
                    <RefreshIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleOpenDeleteDialog(user)}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            margin="normal"
            type="email"
            required
            disabled={editingUser !== null} // Email cannot be changed after creation
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as 'sales' | 'cashier'})}
              label="Role"
            >
              <MenuItem value="sales">Sales Employee</MenuItem>
              <MenuItem value="cashier">Cashier</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={handleCloseDeleteDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Delete User Confirmation
        </DialogTitle>
        <DialogContent>
          {deleteDialog.loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={3}>
              <Typography>Checking user dependencies...</Typography>
            </Box>
          ) : deleteDialog.user && deleteDialog.dependencies ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Are you sure you want to delete user "{deleteDialog.user.full_name}"?
              </Typography>
              
              <Alert 
                severity={deleteDialog.dependencies.canDelete ? 'warning' : 'error'}
                sx={{ mb: 2 }}
              >
                {deleteDialog.dependencies.canDelete 
                  ? 'This action cannot be undone.'
                  : 'Cannot delete this user due to dependencies.'
                }
              </Alert>

              <Typography variant="subtitle2" gutterBottom>
                Impact Analysis:
              </Typography>
              
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                {deleteDialog.dependencies.warnings.map((warning, index) => (
                  <Typography component="li" key={index} variant="body2" sx={{ mb: 1 }}>
                    {warning}
                  </Typography>
                ))}
              </Box>

              {deleteDialog.dependencies.salesTransactions > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Critical:</strong> This user has {deleteDialog.dependencies.salesTransactions} transactions as a sales agent. 
                    Deleting this user would permanently remove these transaction records from the system.
                  </Typography>
                </Alert>
              )}

              {deleteDialog.dependencies.cashierTransactions > 0 && deleteDialog.dependencies.canDelete && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> This user has processed {deleteDialog.dependencies.cashierTransactions} transactions as cashier. 
                    These transactions will remain but will lose their cashier reference.
                  </Typography>
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary">
                User Details:
                <br />• Email: {deleteDialog.user.email}
                <br />• Role: {deleteDialog.user.role.toUpperCase()}
                <br />• Status: {deleteDialog.user.status.toUpperCase()}
                <br />• Created: {new Date(deleteDialog.user.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          ) : (
            <Typography>Loading user information...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>
            Cancel
          </Button>
          {deleteDialog.dependencies?.canDelete && (
            <Button 
              onClick={handleConfirmDelete} 
              color="error" 
              variant="contained"
              startIcon={<DeleteIcon />}
            >
              Delete User
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({...snackbar, open: false})}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({...snackbar, open: false})}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
