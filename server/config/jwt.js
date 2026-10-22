const DEV_FALLBACK_SECRET = 'vem_property_tax_secret_key_2026_super_secure';

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return DEV_FALLBACK_SECRET;
};

module.exports = { getJwtSecret };
