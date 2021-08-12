const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const { connectToDatabase } = require('./db');
const { getAccessToken } = require('./auth');

const S3 = new AWS.S3();

// main handler
exports.maim = async (event, context, callback) => {
    
};