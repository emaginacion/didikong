FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm install node-xmpp-client
COPY . .
EXPOSE 3333
CMD ["node", "xmpp-api.js"]