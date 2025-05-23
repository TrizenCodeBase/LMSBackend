/**
 * Utility functions for generating unique user IDs for students and instructors
 */

/**
 * Generates a random alphanumeric string of specified length
 * @param {number} length - Length of the random string to generate
 * @returns {string} Random alphanumeric string
 * @private
 */
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Generates a unique student ID with format TST followed by 4 random alphanumeric characters
 * @returns {string} Unique student ID (e.g., TST4X9M)
 */
function generateStudentId() {
  return `TST${generateRandomString(4)}`;
}

/**
 * Generates a unique instructor ID with format TIN followed by 4 random alphanumeric characters
 * @returns {string} Unique instructor ID (e.g., TINK27G)
 */
function generateInstructorId() {
  return `TIN${generateRandomString(4)}`;
}

export {
  generateStudentId,
  generateInstructorId,
  generateRandomString
}; 