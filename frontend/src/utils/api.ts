// API utility functions for making HTTP requests

// API Base URL configuration for Docker setup
// Prioritize nginx proxy detection over environment variables
const getApiBaseUrl = () => {
  const currentLocation = window.location;
  console.log('[API] Port detection:', currentLocation.port, 'Protocol:', currentLocation.protocol, 'Host:', currentLocation.host);
  
  // First priority: Check if accessed via nginx proxy (port 80 or no port specified)
  const isNginxProxy = currentLocation.port === '80' || currentLocation.port === '' || currentLocation.port === undefined;
  
  if (isNginxProxy) {
    // Accessed through nginx proxy - use relative API path
    console.log('[API] Detected nginx proxy access - using /api');
    return '/api';
  }
  
  // Second priority: Direct frontend container access - check environment
  if (process.env.REACT_APP_API_URL) {
    console.log('[API] Using env var:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback: Use proxy path for development
  console.log('[API] Using fallback: /api');
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('[API] Using API_BASE_URL:', API_BASE_URL, 'NODE_ENV:', process.env.NODE_ENV);
console.log('[API] Current location:', window.location.href);
console.log('[API] Environment variables:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV
});

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
}

/**
 * Generic API request function with error handling and timeout
 */
export const apiRequest = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const { timeout = 10000, ...fetchOptions } = options;
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    console.log('[API] Making request to:', url, 'from endpoint:', endpoint);
    console.log('[API] Using API_BASE_URL:', API_BASE_URL);
    
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
    
    throw new Error('Network error');
  }
};

/**
 * API request with automatic token handling
 */
export const authenticatedApiRequest = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const token = localStorage.getItem('accessToken');
  
  const authOptions: ApiRequestOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  return apiRequest(endpoint, authOptions);
};

/**
 * Helper for GET requests
 */
export const apiGet = async (endpoint: string): Promise<Response> => {
  return authenticatedApiRequest(endpoint, { method: 'GET' });
};

/**
 * Helper for POST requests
 */
export const apiPost = async (
  endpoint: string,
  data: any
): Promise<Response> => {
  return authenticatedApiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Helper for PUT requests
 */
export const apiPut = async (
  endpoint: string,
  data: any
): Promise<Response> => {
  return authenticatedApiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Helper for DELETE requests
 */
export const apiDelete = async (endpoint: string): Promise<Response> => {
  return authenticatedApiRequest(endpoint, { method: 'DELETE' });
};

/**
 * Helper for binary file downloads with authentication
 */
export const apiBinaryDownload = async (
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const token = localStorage.getItem('accessToken');
  
  const authOptions: ApiRequestOptions = {
    ...options,
    timeout: 30000, // 30 seconds for binary downloads
    headers: {
      // Set Content-Type for JSON payloads, but allow override
      ...(options.body && typeof options.body === 'string' && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  console.log('[API] Binary download request:', {
    endpoint,
    method: authOptions.method || 'GET',
    hasBody: !!authOptions.body,
    headers: authOptions.headers,
    timeout: authOptions.timeout
  });

  return apiRequest(endpoint, authOptions);
};

/**
 * Error handling helper
 */
export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'An error occurred';
  let errorDetails: any[] = [];
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorData.message || errorMessage;
    
    // Preserve validation details if they exist
    if (errorData.details && Array.isArray(errorData.details)) {
      errorDetails = errorData.details;
    }
  } catch {
    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  }
  
  // Create error object with details
  const error = new Error(errorMessage) as any;
  if (errorDetails.length > 0) {
    error.details = errorDetails;
  }
  
  throw error;
};

/**
 * Check if response is successful and parse JSON
 */
export const parseApiResponse = async <T = any>(response: Response): Promise<T> => {
  if (!response.ok) {
    await handleApiError(response);
  }
  
  return response.json();
};
