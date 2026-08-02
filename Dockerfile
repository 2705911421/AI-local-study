FROM node:25-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:web

FROM ghcr.io/nginx/nginx-unprivileged:1.31.1-alpine3.23

LABEL org.opencontainers.image.source="https://github.com/2705911421/AI-local-study"
LABEL org.opencontainers.image.description="知页本地教材伴学工具 Web 版"
LABEL org.opencontainers.image.licenses="Apache-2.0"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/client/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
