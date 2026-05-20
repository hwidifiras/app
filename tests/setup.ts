process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "file:./test.db";
process.env.AUTH_SECRET = "test-secret";
process.env.APP_TIMEZONE = "Africa/Tunis";
