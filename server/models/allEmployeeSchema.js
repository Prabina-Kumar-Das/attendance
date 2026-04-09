const mongoose = require("mongoose")

const allEmployeeSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, index: true, unique: true },
    password: String,
    EmployeeId: String,
    role: String,
    contact: Number,
    theme: { type: String, default: 'light' }
  }
)

const allEmployeeModel = mongoose.model("employees", allEmployeeSchema)

module.exports = allEmployeeModel

// Name
// Email
// Password
// Employee ID
// Role