require("dotenv").config();
require("./models");
const mongoose = require("mongoose");
const app = require("./app");

const port = process.env.PORT || 5000;
const databaseUrl = process.env.DATABASE;

if (!databaseUrl) {
  console.error("DATABASE environment variable is required");
  process.exit(1);
}

if (!process.env.JWT_ACCESS_SECRET) {
  console.error("JWT_ACCESS_SECRET environment variable is required");
  process.exit(1);
}

if (!process.env.INTERNAL_API_SECRET) {
  console.warn(
    "[config] INTERNAL_API_SECRET is not set: /internal/* (n8n, cron) will return 503 until configured."
  );
}

mongoose
  .connect(databaseUrl)
  .then(() => {
    console.log("Database connected");
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to database", err);
    process.exit(1);
  });
