const HttpError = require("../utils/HttpError");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate key" });
  }

  console.error(err);
  return res.status(500).json({
    message: "Internal server error",
    error: err?.message || String(err),
  });
}

module.exports = errorHandler;
