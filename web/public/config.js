// Runtime configuration. Overwritten at container start by nginx/40-runtime-config.sh
// so ONE image can be promoted from staging to production unchanged.
window._env_ = { API_URL: "http://localhost:3001" };
