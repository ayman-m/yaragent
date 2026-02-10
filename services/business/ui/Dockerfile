FROM node:22-alpine AS builder
WORKDIR /app
COPY services/business/ui/package*.json ./
RUN npm install
COPY services/business/ui/ .
RUN mkdir -p public
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g next
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public || true
COPY --from=builder /app/package.json ./
EXPOSE 3000
ENV NEXT_PUBLIC_BACKEND_URL=http://backend:8000
CMD ["npm", "start"]
