FROM node:20-alpine AS build
WORKDIR /app
# Copy root files needed for versioning
COPY VERSION ./
COPY scripts/ ./scripts/

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/frontend/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-p", "3000"]
