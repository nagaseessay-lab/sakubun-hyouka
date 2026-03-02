export const SCORE_RANGES = {
  FIRST_PHASE_MIN: 0,
  FIRST_PHASE_MAX: 4,
  SECOND_PHASE_MIN: 0,
  SECOND_PHASE_MAX: 3,
  CHAR_THRESHOLD: 1200,
  LEVEL4_PER_BATCH: 1,
  LEVEL4_BATCH_SIZE: 50,
};

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
};

export const JWT_EXPIRY = {
  ACCESS: 8 * 60 * 60,   // 8 hours in seconds
  REFRESH: 7 * 24 * 60 * 60, // 7 days in seconds
};

export const UPLOAD = {
  MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
  ALLOWED_MIME: ['application/pdf', 'application/x-pdf', 'application/octet-stream'],
};
