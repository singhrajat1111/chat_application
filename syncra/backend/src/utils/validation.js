// UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Username: alphanumeric, underscores, hyphens only
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_USERNAME_LENGTH = 32;
export const MIN_USERNAME_LENGTH = 3;
export const MIN_PASSWORD_LENGTH = 6;

export const isValidUUID = (str) => UUID_REGEX.test(str);

export const isValidUsername = (str) => USERNAME_REGEX.test(str);

export const isValidEmail = (str) => {
  if (!str || str.length > 255) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
};

// Sanitize user-generated text content (strip zero-width chars, trim)
export const sanitizeContent = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .trim();
};

// Validate route param is UUID — Express middleware factory
export const validateUUIDParam = (...paramNames) => {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !isValidUUID(value)) {
        return res.status(400).json({ error: `Invalid ${name}` });
      }
    }
    next();
  };
};
