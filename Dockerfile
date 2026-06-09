FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 9528
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:9528/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
