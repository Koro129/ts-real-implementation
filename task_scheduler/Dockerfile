FROM node:18
       WORKDIR /task_scheduler
       COPY package*.json ./
       RUN npm install
       COPY . .
       CMD ["node", "index.js"]