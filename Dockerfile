# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --force
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --force --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Secrets (DATABASE_URL, JWT_SECRET, CORS_ORIGINS) are provided at runtime
# by the hosting platform (e.g. Railway service variables). Never bake them in.
# Railway injects PORT; main.ts listens on process.env.PORT ?? 3000.
EXPOSE 3000
CMD ["node", "dist/main"]
