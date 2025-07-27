/**
 * Token number formatting utility
 * Formats token numbers with zero padding for consistent display
 */

/**
 * Format a token number with zero padding
 * @param tokenNumber - The token number to format
 * @returns A formatted token number string with zero padding (e.g., "001", "002", etc.)
 */
export const formatTokenNumber = (tokenNumber: number | string): string => {
  const numericToken = typeof tokenNumber === 'string' ? parseInt(tokenNumber) : tokenNumber;
  
  // Handle invalid or null token numbers
  if (isNaN(numericToken) || numericToken < 0) {
    return '000';
  }
  
  // Format with zero padding (3 digits)
  return numericToken.toString().padStart(3, '0');
};

/**
 * Format a token number with hash prefix for display
 * @param tokenNumber - The token number to format
 * @returns A formatted token number string with hash prefix (e.g., "#001", "#002", etc.)
 */
export const formatTokenNumberWithHash = (tokenNumber: number | string): string => {
  return `#${formatTokenNumber(tokenNumber)}`;
};
