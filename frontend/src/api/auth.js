import http from "./client";
import { paths } from "./paths";

/** Auth-related API calls (cookies handled by axios `withCredentials`). */
export const authApi = {
  register: (body) => http.post(paths.auth.register, body),
  login: (body) => http.post(paths.auth.login, body),
  logout: () => http.post(paths.auth.logout),
  verifyEmail: (params) =>
    http.get(paths.auth.verifyEmail, { params }),
  resendVerification: (body) => http.post(paths.auth.resendVerification, body),
  forgotPassword: (body) => http.post(paths.auth.forgotPassword, body),
  resetPassword: (body) => http.post(paths.auth.resetPassword, body),
  me: () => http.get(paths.auth.me),
};
