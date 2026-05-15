# Use an LTS Node image
FROM node:20-alpine AS base

WORKDIR /usr/src/app

# Install deps
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "app.js"]
