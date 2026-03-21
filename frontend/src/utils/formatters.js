/**
 * Format number with dot thousand separators (Icelandic format: 200000 -> "200.000")
 * Handles both numeric values and string input with non-digits
 */
export const formatWithDots = (num) => {
  if (num === '' || num === null || num === undefined) return '';
  
  let numStr;
  if (typeof num === 'number') {
    // For numbers: parse and floor
    numStr = Math.floor(num).toString();
  } else {
    // For strings: remove non-digits
    numStr = String(num).replace(/\D/g, '');
  }
  
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Remove dot thousand separator format (e.g., "200.000" -> "200000")
 */
export const removeDots = (str) => {
  if (str == null || str === '') return '';
  return String(str).replace(/\./g, '');
};
