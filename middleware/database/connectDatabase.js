const mongoose = require('mongoose');
require('dotenv').config();

mongoose
    .connect(process.env.DB_URI)
    // .connect(
    //     // `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oiez83c.mongodb.net/${process.env.DB_NAME}`
    //     'mongodb+srv://admin_db_user:xbxBgVBtLVTdKqFW@hawksyn.taaae9x.mongodb.net/'
    // )
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const { db } = mongoose.connection;
module.exports = db;
