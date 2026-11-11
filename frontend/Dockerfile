# ── build ────────────────────────────────────────────────────────────────────
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Empty on purpose. src/api/client.ts falls back to http://localhost:6001 in a
# production build when VITE_API_URL is unset, which only works on the machine
# running Docker. Building with an empty value makes every request relative, so
# nginx serves the app and proxies the API on one origin — no CORS, no hostname
# baked into the bundle.
ENV VITE_API_URL=""

RUN npm run build

# ── serve ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, not localhost: busybox wget resolves localhost to ::1 first, and
# nginx listens on IPv4 only, so the check failed while the site was serving.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
