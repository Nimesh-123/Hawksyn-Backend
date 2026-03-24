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
      { name: "1. Authentication & Security", description: "Signup, Login, OTP, and Pin management" },
      { name: "2. Onboarding (Profile Setup)", description: "CV Upload and Profile Confirmation" },
      { name: "3. Discovery (Explore Cases)", description: "Browse available cases, intents, and playbooks" },
      { name: "4. Payments & Run Initiation", description: "Pricing, Payment processing, and run setup" },
      { name: "5. Run Operations (AI Flow)", description: "Questions batching, AI Parsing, and Case File building" },
      { name: "6. My Records & Reports", description: "User history, detailed run results, and PDF reports" },
      { name: "7. Expert Support & Chat", description: "Expert query processing and chat interface" },
      { name: "8. Command Center & Trends", description: "Real-time career clocks and market signals" },
      { name: "9. Admin Dashboard", description: "User Management, Audit Logs, and System Oversight" },
    ],
  },

  apis: [
    path.join(__dirname, "../src/routes/**/*.js"),
    path.join(__dirname, "../src/controllers/**/*.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
