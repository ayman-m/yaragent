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
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV NEXT_PUBLIC_BACKEND_URL=http://backend:8002
CMD ["npm", "start"]
