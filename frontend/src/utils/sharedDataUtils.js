import axios from 'axios';

/**
 * Get current user's email from the API
 * @returns {Promise<string>} Current user email
 */
let cachedUserEmail = null;

export const getCurrentUserEmail = async () => {
  if (cachedUserEmail) {
    return cachedUserEmail;
  }
  
  try {
    const response = await axios.get('/api/user/settings/');
    cachedUserEmail = response.data.email;
    return cachedUserEmail;
  } catch (error) {
    console.error('Failed to get current user email:', error);
    return null;
  }
};

/**
 * Check if a resource is shared (owned by another user)
 * @param {object} resource - The resource object with user_email field
 * @param {string} currentUserEmail - Email of current user
 * @returns {boolean} True if resource is shared with current user
 */
export const isSharedResource = (resource, currentUserEmail) => {
  return resource && resource.user_email && resource.user_email !== currentUserEmail;
};

/**
 * Get a display label for shared resources
 * @param {object} resource - The resource object
 * @param {string} currentUserEmail - Email of current user
 * @returns {string} Label indicating owner if shared, empty string if own
 */
export const getResourceOwnerLabel = (resource, currentUserEmail) => {
  if (isSharedResource(resource, currentUserEmail)) {
    return ` (from ${resource.user_email})`;
  }
  return '';
};

/**
 * Clear cached user email (call on logout)
 */
export const clearUserEmailCache = () => {
  cachedUserEmail = null;
};
