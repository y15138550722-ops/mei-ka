FROM node:20-alpine AS builder

WORKDIR /app/src

COPY src/package*.json ./
RUN npm ci

COPY docs /app/docs
COPY src /app/src

RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/src/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
