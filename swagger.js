const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kelime Mayınları API',
      version: '1.0.0',
      description: 'Kelime Mayınları oyunu için REST API dokümantasyonu'
    },
    servers: [
      { url: 'http://localhost:3001' }
    ],
  },
  apis: ['./routes/*.js'], // Açıklamaları bu klasörde arar
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
