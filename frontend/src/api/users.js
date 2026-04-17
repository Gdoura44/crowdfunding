import http from "./client";
import { paths } from "./paths";

export const usersApi = {
  getProfile: () => http.get(paths.users.profile),
  updateProfile: (body) => http.put(paths.users.profile, body),
  deleteAccount: () => http.post(paths.users.deleteAccount),
};

