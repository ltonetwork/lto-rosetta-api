FROM node:14-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY tsconfig*.json ./
COPY .eslintrc ./
COPY src src
RUN npm ci
RUN npm run build


FROM legalthings/public-node:latest
ENV NODE_ENV=production
USER root
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN npm i -g forever

WORKDIR /usr/src/app
COPY package*.json ./
COPY rosetta-api.json ./
COPY .env ./
RUN npm install
COPY --from=builder /usr/src/app/dist/ dist/
COPY .env ./dist/
EXPOSE 8080 6869 6868 6863 6862

