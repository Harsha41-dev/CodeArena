FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build -w apps/api
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "apps/api"]
