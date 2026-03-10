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
    tags: [
      { name: "1. Authentication & Security", description: "Login, OTP, and Pin management" },
      { name: "2. Onboarding (Persistent Profile)", description: "Cross-run profile setup and confirmation" },
      { name: "3. Discovery (Explore Cases)", description: "Browse available cases and intents" },
      { name: "4. Payments & Run Setup", description: "Payment processing and run initiation" },
      { name: "5. Run Operations (Specific Actions)", description: "Actions specific to an active validation run" },
      { name: "6. Admin", description: "Logs and system management" },
    ],
  },

  apis: [
    path.join(__dirname, "../src/routes/**/*.js"),
    path.join(__dirname, "../src/controllers/**/*.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
