# Global Toast & Dialog Components

This directory contains the implementation of the global notification system and session management components for the frontend application.

## Components

### 1. NotificationProvider

A React context provider that manages global notifications using MUI's `Snackbar` and `Alert` components.

#### Features
- Multiple notification types: `info`, `warn`, `error`, `success`
- Customizable duration for each notification
- Automatic dismissal after specified duration
- Click-to-close functionality
- Stacked notifications support
- Positioned at bottom-right of screen

#### Usage

```typescript
import { useNotification } from '../../contexts/NotificationContext';

function MyComponent() {
  const { notify, info, warn, error, success } = useNotification();

  const handleAction = () => {
    // Simple usage
    success('Operation completed successfully!');
    
    // Custom duration (default is 6000ms)
    info('This message will stay for 10 seconds', 10000);
    
    // Generic notify function
    notify('Custom message', 'warning', 5000);
  };

  return (
    <button onClick={handleAction}>
      Trigger Notification
    </button>
  );
}
```

#### API Reference

```typescript
interface NotificationContextType {
  notify: (message: string, severity: AlertColor, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warn: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  close: (id?: string) => void;
}
```

### 2. SessionExpiredDialog

A modal dialog component that appears when the user's session expires, offering options to re-login or dismiss.

#### Features
- Modal dialog with backdrop blur
- Warning icon and styled content
- Two action buttons: "Dismiss" and "Re-login"
- Automatic logout and redirect to login page
- Stores current location for post-login redirect
- Prevents closing via backdrop click or escape key

#### Usage

```typescript
import SessionExpiredDialog from './SessionExpiredDialog';

function MyComponent() {
  const [open, setOpen] = useState(false);

  const handleRelogin = () => {
    // Handle re-login logic
    navigate('/login');
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <SessionExpiredDialog
      open={open}
      onClose={handleClose}
      onRelogin={handleRelogin}
    />
  );
}
```

### 3. SessionManager

A wrapper component that integrates the session expiration dialog with the authentication context.

#### Features
- Automatically shows session expiration dialog when session expires
- Integrates with AuthContext for session state management
- Provides navigation logic for re-login
- Stores redirect path for post-login navigation

#### Usage

The SessionManager is automatically integrated at the app level and wraps all routes.

## Integration

### App-level Integration

The components are integrated into the main App component hierarchy:

```typescript
function App() {
  return (
    <CustomThemeProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <DarkModeWrapper>
          <NotificationProvider>
            <AuthProvider>
              <SocketProvider>
                <Router>
                  <SessionManager>
                    <Routes>
                      {/* Your routes */}
                    </Routes>
                  </SessionManager>
                </Router>
              </SocketProvider>
            </AuthProvider>
          </NotificationProvider>
        </DarkModeWrapper>
      </ThemeProvider>
    </CustomThemeProvider>
  );
}
```

### Component Integration

To use notifications in any component:

```typescript
import { useNotification } from '../../contexts/NotificationContext';

function CustomerForm() {
  const { success, error } = useNotification();

  const handleSubmit = async (data) => {
    try {
      await saveCustomer(data);
      success('Customer saved successfully!');
    } catch (err) {
      error('Failed to save customer. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form content */}
    </form>
  );
}
```

## Styling

The components use MUI's theme system and can be customized through:

1. **Theme overrides**: Modify the MUI theme to change default styles
2. **sx prop**: Use the `sx` prop for component-specific styling
3. **CSS custom properties**: Use CSS variables for theme-aware styling

### Example Theme Customization

```typescript
const theme = createTheme({
  components: {
    MuiSnackbar: {
      styleOverrides: {
        root: {
          // Custom snackbar styles
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          // Custom alert styles
        }
      }
    }
  }
});
```

## Testing

Example test for notification functionality:

```typescript
import { render, screen } from '@testing-library/react';
import { NotificationProvider } from '../../contexts/NotificationContext';
import NotificationExample from './NotificationExample';

test('shows notification when button clicked', async () => {
  render(
    <NotificationProvider>
      <NotificationExample />
    </NotificationProvider>
  );

  const button = screen.getByRole('button', { name: /show success/i });
  fireEvent.click(button);

  expect(screen.getByText('Operation completed successfully!')).toBeInTheDocument();
});
```

## Best Practices

1. **Use semantic notification types**: Choose the appropriate type (info, warn, error, success) based on the message context
2. **Keep messages concise**: Notifications should be brief and actionable
3. **Provide appropriate duration**: Short messages can have shorter durations, important messages should stay longer
4. **Don't overuse notifications**: Too many notifications can overwhelm users
5. **Test accessibility**: Ensure notifications are accessible to screen readers and keyboard users

## Migration from existing notification systems

If you're migrating from another notification system:

1. Replace existing notification calls with the new context hooks
2. Update imports to use the new context
3. Remove old notification dependencies
4. Update tests to work with the new system

## Dependencies

- `@mui/material` - UI components
- `@mui/icons-material` - Icons
- `react` - React hooks and context
- `react-router-dom` - Navigation for session management
