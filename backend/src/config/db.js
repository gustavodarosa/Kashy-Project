const mongoose = require('mongoose');

const connectDB = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('MongoDB Connected');
    } catch (error) {
      console.error('MongoDB connection failed, retrying in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  };

module.exports = connectDB;