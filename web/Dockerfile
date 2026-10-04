FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
USER root
RUN apk upgrade --no-cache
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build --chown=101:101 /app/build /usr/share/nginx/html
ENV API_URL=http://localhost:3001
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
