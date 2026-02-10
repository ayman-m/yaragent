FROM node:22-alpine AS builder
WORKDIR /app
COPY services/business/ui/package*.json ./
RUN npm install
COPY services/business/ui/ .
RUN mkdir -p public
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl curl
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENV NEXT_PUBLIC_API_BASE=/api
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
