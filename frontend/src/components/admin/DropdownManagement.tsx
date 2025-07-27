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
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface DropdownItem {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const DropdownManagement: React.FC = () => {
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<DropdownItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const [type, setType] = useState<'grade' | 'lens'>('grade');
  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/${type}-types`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data);
      } else {
        throw new Error('Failed to fetch items');
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch items',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [type]);

  const handleOpenDialog = (item?: DropdownItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: ''
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = editingItem 
        ? `/api/admin/${type}-types/${editingItem.id}` 
        : `/api/admin/${type}-types`;
      
      const method = editingItem ? 'PUT' : 'POST';
      
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
          message: editingItem ? `${type === 'grade' ? 'Grade' : 'Lens'} type updated successfully` : `${type === 'grade' ? 'Grade' : 'Lens'} type created successfully`,
          severity: 'success'
        });
        handleCloseDialog();
        fetchItems();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save item',
        severity: 'error'
      });
    }
  };

  const handleDelete = async (item: DropdownItem) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`/api/admin/${type}-types/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: `${type === 'grade' ? 'Grade' : 'Lens'} type deleted successfully`,
          severity: 'success'
        });
        fetchItems();
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete item',
        severity: 'error'
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading types...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" gutterBottom>
          {type === 'grade' ? 'Grade Type Management' : 'Lens Type Management'}
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchItems}
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
            Add New
          </Button>
          <Button
            onClick={() => setType(type === 'grade' ? 'lens' : 'grade')}
            sx={{ ml: 2 }}
          >
            {type === 'grade' ? 'Switch to Lens Types' : 'Switch to Grade Types'}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleOpenDialog(item)}
                    color="primary"
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(item)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? `Edit ${type === 'grade' ? 'Grade' : 'Lens'} Type` : `Add New ${type === 'grade' ? 'Grade' : 'Lens'} Type`}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingItem ? 'Update' : 'Create'}
          </Button>
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

export default DropdownManagement;
