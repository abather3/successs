import React, { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface DarkModeWrapperProps {
  children: React.ReactNode;
}

const DarkModeWrapper: React.FC<DarkModeWrapperProps> = ({ children }) => {
  const { darkMode } = useTheme();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return <>{children}</>;
};

export default DarkModeWrapper;
