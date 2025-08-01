import React from 'react';
import { styled } from '@mui/material/styles';

interface CircularLogoProps {
  size?: number;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

const CircularLogoContainer = styled('div')<{ size: number }>(({ size }) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
  border: '2px solid #e0e0e0',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  },
}));

const LogoImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
});

const CircularLogo: React.FC<CircularLogoProps> = ({
  size = 60,
  className,
  alt = 'EscaShop Logo',
  onClick,
}) => {
  return (
    <CircularLogoContainer
      size={size}
      className={className}
      onClick={onClick}
    >
      <LogoImage
        src="/escashop-logo.png"
        alt={alt}
        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
          console.error('Logo failed to load:', e);
        }}
      />
    </CircularLogoContainer>
  );
};

export default CircularLogo;
