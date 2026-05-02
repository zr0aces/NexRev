FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./backend/
RUN apk add --no-cache python3 make g++
RUN cd backend && npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY VERSION ./
COPY scripts/ ./scripts/
COPY backend/package*.json ./backend/
RUN apk add --no-cache python3 make g++
RUN cd backend && npm ci
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
RUN cd backend && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
RUN mkdir -p /app/data
EXPOSE 3001
WORKDIR /app/backend
CMD ["node", "dist/server.js"]
