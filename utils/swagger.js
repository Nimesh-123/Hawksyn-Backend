const swaggerJSDoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hawksyn Backend API",
      version: "1.0.0",
      description: "API documentation for Hawksyn Backend with Email OTP and M-PIN authentication flow",
    },
    servers: [
      {
        url: `${process.env.API_URL}` || "http://localhost:3001/api/v1",
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [
    path.join(__dirname, "../src/routes/**/*.js"),
    path.join(__dirname, "../src/controllers/**/*.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
