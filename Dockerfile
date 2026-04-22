FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN cd frontend && npm install
RUN cd frontend && npx ng build --configuration production
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/frontend /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
