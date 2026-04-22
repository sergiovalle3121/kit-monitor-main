FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN cd axos-os-frontend && npm install
RUN cd axos-os-frontend && npx ng build --configuration production
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/axos-os-frontend/dist/axos-os-frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
