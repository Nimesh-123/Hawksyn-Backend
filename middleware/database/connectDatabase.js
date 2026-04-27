const mongoose = require('mongoose');
require('dotenv').config();

mongoose
    .connect(process.env.DB_URI)
    // .connect(
    //     // `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oiez83c.mongodb.net/${process.env.DB_NAME}`
    //     'mongodb+srv://admin_db_user:xbxBgVBtLVTdKqFW@hawksyn.taaae9x.mongodb.net/'
    // )
    .then(() => {
        const { host, name } = mongoose.connection;
        console.log(`[Database] MongoDB Connected: ${host}/${name}`);
    })
    .catch(err => console.error('[Database] Connection Error:', err));

const { db } = mongoose.connection;
module.exports = db;
