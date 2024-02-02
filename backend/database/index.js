const mongoose = require("mongoose");
const { MONGODB_CONNECTION_STRING } = require("../config/index");

const dbConnect = async () => {
  try {
    mongoose.set("strictQuery", false);
    const conn = await mongoose.connect(MONGODB_CONNECTION_STRING);
    console.log(`Dataabase connected to the host : ${conn.connection.host}`);
  } catch (error) {
    console.log(`Error: ${error}`);
  }
};

module.exports = dbConnect;
