// API utility functions for making HTTP requests

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

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
 * Error handling helper
 */
export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'An error occurred';
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorData.message || errorMessage;
  } catch {
    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  }
  
  throw new Error(errorMessage);
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
