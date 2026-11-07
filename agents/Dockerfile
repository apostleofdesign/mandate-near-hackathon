FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY src ./src
COPY tsconfig.json ./
CMD ["npm", "start"]
