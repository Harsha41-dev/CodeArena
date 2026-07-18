FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
RUN npm install
COPY . .
RUN npm run build -w apps/web
EXPOSE 5173
CMD ["npm", "run", "preview", "-w", "apps/web", "--", "--host", "0.0.0.0"]
