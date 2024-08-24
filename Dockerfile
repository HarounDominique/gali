# Usa una imagen base de Node.js para la etapa de construcción
FROM node:20 AS build

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto de los archivos del proyecto
COPY . .

# Compila la aplicación Angular (sin argumentos adicionales)
RUN npm run build

# Usa una imagen base de Nginx para servir archivos estáticos
FROM nginx:alpine

# Copia los archivos compilados al directorio de salida de Nginx
COPY --from=build /app/dist/gali-client /usr/share/nginx/html

# Expone el puerto en el que la aplicación estará escuchando
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
