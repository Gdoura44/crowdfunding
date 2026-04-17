import axios from "axios";
import { getApiBaseUrl } from "../config/api";
import { paths } from "./paths";

const http = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

let refreshPromise = null;

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error.config;
    if (!error.response || error.response.status !== 401 || cfg._retry) {
      return Promise.reject(error);
    }
    const url = cfg.url || "";
    if (
      url.includes(paths.auth.refresh) ||
      url.includes(paths.auth.login) ||
      url.includes(paths.auth.register)
    ) {
      return Promise.reject(error);
    }
    cfg._retry = true;
    try {
      refreshPromise =
        refreshPromise ||
        http.post(paths.auth.refresh).finally(() => {
          refreshPromise = null;
        });
      await refreshPromise;
      return http(cfg);
    } catch (e) {
      return Promise.reject(e);
    }
  }
);

export default http;
