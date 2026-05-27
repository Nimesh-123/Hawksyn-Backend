require('dotenv').config();

const config = {
  mongodb: {
    // We can use the connection string from the .env file
    url: process.env.DB_URI || "mongodb://localhost:27017",

    // Extract the database name from the URL if needed, or specify it here
    // In this case we assume DB_URI includes the DB name, but migrate-mongo
    // often likes a specific databaseName parameter. We will set it to the default
    // or let it derive from the connection string if not specified here.
    databaseName: process.env.DB_NAME || "hawksyn",

    options: {
      // Use standard mongoose connection options here if necessary
    }
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: "migrations",

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: "changelog",

  // The file extension to create migrations and search for in migration dir 
  migrationFileExtension: ".js",

  // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determine
  // if the file should be run.  Requires that scripts are coded to be run multiple times.
  useFileHash: false,

  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs',
};

module.exports = config;
