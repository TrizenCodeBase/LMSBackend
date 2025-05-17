# Use a base image for Node.js
FROM node:20-alpine as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Expose port your Node app uses (usually 5001)
EXPOSE 5001

# Start the Node.js app
CMD ["node", "server.js"]
