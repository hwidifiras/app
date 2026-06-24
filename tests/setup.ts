process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://gymday:gymday@localhost:5432/gymday_test?schema=public";
process.env.AUTH_SECRET = "test-secret";
process.env.APP_TIMEZONE = "Africa/Tunis";
process.env.SAAS_ROOT_DOMAIN = "localhost";
process.env.DEFAULT_TENANT_SLUG = "we-discipline";
process.env.RESEND_API_KEY = "";
process.env.PASSWORD_RESET_FROM = "";
