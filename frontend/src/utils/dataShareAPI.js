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

/**
 * Initiate an ownership transfer for a property
 * @param {number} propertyId - ID of the property to transfer
 * @param {string} toUserEmail - Email of the user to transfer ownership to
 * @returns {Promise} Response from the API
 */
export const initiateOwnershipTransfer = async (propertyId, toUserEmail) => {
  try {
    const response = await axios.post('/api/ownership-transfer/', {
      property: propertyId,
      to_user_email: toUserEmail,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all pending ownership transfers initiated by the current user
 * @returns {Promise} Array of OwnershipTransfer objects
 */
export const getPendingTransfers = async () => {
  try {
    const response = await axios.get('/api/ownership-transfer/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Cancel a pending ownership transfer
 * @param {number} transferId - ID of the transfer to cancel
 * @returns {Promise} Response from the API
 */
export const cancelTransfer = async (transferId) => {
  try {
    const response = await axios.post(`/api/ownership-transfer/${transferId}/cancel/`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Dismiss a completed/cancelled/expired ownership transfer (soft-delete via DELETE)
 * @param {number} transferId - ID of the transfer to dismiss
 * @returns {Promise} Response from the API
 */
export const dismissTransfer = async (transferId) => {
  try {
    await axios.delete(`/api/ownership-transfer/${transferId}/`);
  } catch (error) {
    throw error;
  }
};

/**
 * Confirm an ownership transfer using the token from the confirmation email
 * @param {string} token - The confirmation token from the email link
 * @returns {Promise} Response from the API
 */
export const confirmTransfer = async (token) => {
  try {
    const response = await axios.get(`/api/ownership-transfer/confirm/${token}/`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
