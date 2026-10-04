export const API_URL =
  (window._env_ && window._env_.API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";
