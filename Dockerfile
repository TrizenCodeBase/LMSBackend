# INSIDE /backend
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY backend/ ./

# Expose port your Node app uses (usually 5001)
EXPOSE 5001
CMD ["node", "server.js"]