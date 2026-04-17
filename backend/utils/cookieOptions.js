const ACCESS_MAX_MS = 15 * 60 * 1000;
const REFRESH_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

function accessTokenCookieOptions() {
  return { ...baseCookieOptions(), maxAge: ACCESS_MAX_MS };
}

function refreshTokenCookieOptions() {
  return { ...baseCookieOptions(), maxAge: REFRESH_MAX_MS };
}

module.exports = {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
};
