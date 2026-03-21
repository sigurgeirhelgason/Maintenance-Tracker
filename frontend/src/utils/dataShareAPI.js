import axios from '../axiosConfig';

/**
 * Create a new data share invitation
 * @param {string} email - Email of the user to share with
 * @param {object} permissions - Permissions object (e.g., {properties: 'rw', tasks: 'rw', ...})
 * @returns {Promise} Response from the API
 */
export const createDataShare = async (email, permissions = null) => {
  try {
    const data = {
      shared_with_email: email,
      permissions: permissions || {
        properties: 'rw',
        tasks: 'rw',
        vendors: 'rw',
        areas: 'rw',
        attachments: 'rw',
      },
    };
    
    const response = await axios.post('/api/datashare/', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all data shares (both created and received)
 * @returns {Promise} Array of DataShare objects
 */
export const getDataShares = async () => {
  try {
    const response = await axios.get('/api/datashare/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a data share (only creator can delete)
 * @param {number} shareId - ID of the DataShare to delete
 * @returns {Promise} Response from the API
 */
export const deleteDataShare = async (shareId) => {
  try {
    await axios.delete(`/api/datashare/${shareId}/`);
  } catch (error) {
    throw error;
  }
};

/**
 * Update permissions for an existing data share
 * @param {number} shareId - ID of the DataShare to update
 * @param {object} permissions - Updated permissions object
 * @returns {Promise} Updated DataShare object
 */
export const updateDataSharePermissions = async (shareId, permissions) => {
  try {
    const response = await axios.patch(`/api/datashare/${shareId}/`, {
      permissions,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
