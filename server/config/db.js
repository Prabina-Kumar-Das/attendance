const mongoose = require("mongoose")

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGOOSE_KEY, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    })
    console.log("✅ MongoDB Atlas Connected Successfully!");
    
  } catch (error) {
    console.log("❌ Failed to Connect to MongoDB Atlas");
    console.log(error);
    process.exit(1); // Exit process on connection failure
  }
}


module.exports = connectDB