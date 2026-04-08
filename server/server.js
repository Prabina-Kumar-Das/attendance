require("dotenv").config()
require("dns").setDefaultResultOrder("ipv4first");
const express = require("express")
const connectDB = require("./config/db")
const allEmployeeModel = require("./models/allEmployeeSchema")
const bcrypt = require("bcrypt")
const sendMailServices = require("./services/mailservices")
const passwordValidation = require("./utils/passwordValidation")
const otpService = require("./utils/otpGeneration")
const sendOTPServices = require("./services/otpServices")
const otpModel = require("./models/otpSchema")
const geofenceModel = require("./models/geofenceSchema")
const alertModel = require("./models/alertSchema")
const locationLogModel = require("./models/locationLogSchema")
const updateRequestModel = require("./models/updateRequestSchema")
const leaveRequestModel = require("./models/leaveRequestSchema")
const sendBreachAlertEmail = require("./services/breachmailservice")
const cors = require("cors")
const compression = require("compression")
const app = express()
app.use(compression()) // gzip all responses
app.use(express.json())
app.use(cors({ origin: "*" }))

console.log(process.env.APP_EMAIL);



connectDB()

// Health check for Render
app.get("/", (req, res) => res.status(200).json({ status: "ok" }));

app.post("/register", async (req, res) => {

  const employee = req.body
  try {

    const isvalid = passwordValidation(employee.password)
    if(!isvalid) {
      return res.status(401).json({message: " at least one lowercase letter is present in the string and at least one uppercase letter is present. and  at least one digit (0-9) is present. and at least one special character from the specified set is present. and  minimum length of 8 characters"})
    }
    const hashedPassword = await bcrypt.hash(employee.password, 6)

   const data =  await allEmployeeModel.insertOne({...employee, password:hashedPassword})
    res.status(201).json({message: "Account  Created"})
    console.log(data);
    sendMailServices(employee.email, "Registration Sucessfully", employee.name).catch(console.error);
    
  } catch (error) {
    res.status(500).json({message: "Internal Server Error"})
    console.log(error);
  }
})


app.post("/login", async (req, res) => {
  const {email, password} = req.body
  try {
    const employee = await allEmployeeModel.findOne({email})
    if(!employee) {
      return res.status(404).json({message: "Email not Registered!"})
    }
    const match = await bcrypt.compare(password, employee.password)
    if(!match) {
      return res.status(401).json({message: "Incorrrect Password"})
    }
    const OTP = String(otpService());
    console.log(employee.name);

    if(!OTP) {
      return res.status(500).json({message: "Failed to send OTP"})
    }

    sendOTPServices(email, `OTP send Sucessfully ${employee.name}`, OTP).catch(console.error);

    const hashedOTP = await bcrypt.hash(OTP, 6)

    await otpModel.insertOne({otp: hashedOTP, userId: employee._id})

    res.status(200).json({message: "OTP send Sucessfully."})

    

  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Internal Server Error."})
  }
})

app.post("/verify-otp", async (req, res) => {
  const {email, otp} = req.body;

  try {
    if(!email || !otp) {
      return res.status(400).json({message: "Email and OTP are Required"})
    }

    const employee = await allEmployeeModel.findOne({email})
    if(!employee) {
      return res.status(404).json({message: "User not Found.."})
    }
    const OTPDoc = await otpModel.findOne({userId: employee._id }).sort({ _id: -1 });
    if(!OTPDoc) {
      return res.status(400).json({message: "Otp-Expires"})
    }
    const verifyOTP = await bcrypt.compare(otp, OTPDoc.otp)

    if(!verifyOTP) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." })
    }

    return res.status(200).json({ 
      message: "Login Successful!",
      user: {
        name: employee.name,
        role: employee.role,
        email: employee.email
      }
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
})
app.get("/employees", async (req, res) => {
  try {
    const employees = await allEmployeeModel.find({}).select("-password"); // do not send passwords
    res.status(200).json(employees);
  } catch (error) {
    console.log(error);
    res.status(500).json({message: "Failed to fetch employees"});
  }
});

// Geofence API
app.get("/geofence", async (req, res) => {
  try {
    let geofence = await geofenceModel.findOne({ name: "Master" });
    if (!geofence) {
      // Create default if it doesn't exist
      geofence = await geofenceModel.create({
        name: "Master",
        lat: 20.2961,
        lng: 85.8245,
        radius: 200
      });
    }
    res.status(200).json(geofence);
  } catch (error) {
    console.log(error);
    res.status(500).json({message: "Failed to fetch geofence"});
  }
});

app.post("/geofence", async (req, res) => {
  try {
    const { lat, lng, radius } = req.body;
    let geofence = await geofenceModel.findOne({ name: "Master" });
    if (geofence) {
      geofence.lat = lat;
      geofence.lng = lng;
      geofence.radius = radius;
      await geofence.save();
    } else {
      geofence = await geofenceModel.create({ name: "Master", lat, lng, radius });
    }
    res.status(200).json(geofence);
  } catch (error) {
    console.log(error);
    res.status(500).json({message: "Failed to update geofence"});
  }
});

// --- NEW GEOFENCE SECURITY & TRACKING API ENDPOINTS ---

// 1. Employee posts their real-time location
app.post("/api/location", async (req, res) => {
  try {
    const { email, lat, lng, status, punchInTime, punchInLocation } = req.body;
    if (!email || !lat || !lng) return res.status(400).json({message: "Missing parameters"});
    
    const employee = await allEmployeeModel.findOne({email});
    if (!employee) return res.status(404).json({message: "User not found"});

    // Update or create location log for this employee
    let log = await locationLogModel.findOne({ userEmail: email });
    if (log) {
      log.lat = lat;
      log.lng = lng;
      log.status = status || log.status;
      if (punchInTime) log.punchInTime = punchInTime;
      if (punchInLocation) log.punchInLocation = punchInLocation;
      await log.save();
    } else {
      await locationLogModel.create({
        userEmail: email,
        userName: employee.name,
        userRole: employee.role,
        lat, lng, 
        status: status || "Inside",
        punchInTime: punchInTime || "Not Punched",
        punchInLocation: punchInLocation || "Unknown"
      });
    }
    res.status(200).json({message: "Location updated"});
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Server Error"});
  }
});

// 2. Trigger breach & send OTP
app.post("/api/breach-trigger", async (req, res) => {
  try {
    const { email, lat, lng } = req.body;
    if (!email) return res.status(400).json({message: "Email required"});

    const employee = await allEmployeeModel.findOne({email});
    if (!employee) return res.status(404).json({message: "User not found"});

    // Check if there's already an active 'Pending' alert
    const existingAlert = await alertModel.findOne({ userEmail: email, status: "Pending" });
    if (existingAlert) {
      // Check if it's expired
      if (new Date() > existingAlert.expiresAt) {
        existingAlert.status = "Alarm";
        existingAlert.detail = "OTP Verification Timeout";
        await existingAlert.save();
      } else {
        return res.status(200).json({ message: "Alert already pending", alertId: existingAlert._id, expiresAt: existingAlert.expiresAt });
      }
    }

    // Generate new OTP
    const OTP = String(otpService());
    console.log(`[BREACH] OTP for ${employee.name} is ${OTP}`);
    
    // Hash and store OTP
    const hashedOTP = await bcrypt.hash(OTP, 6);
    await otpModel.insertOne({ otp: hashedOTP, userId: employee._id });

    // Send dedicated breach security alert email with GPS location & OTP
    sendBreachAlertEmail(email, employee.name, OTP, lat || 0, lng || 0).catch(console.error);

    // Create tracking Alert
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    const newAlert = await alertModel.create({
      userId: employee._id,
      userEmail: email,
      userName: employee.name,
      lat, lng,
      expiresAt: expires,
      status: "Pending",
      detail: "OTP verification required."
    });

    res.status(200).json({ message: "OTP sent and breach registered", alertId: newAlert._id, expiresAt: expires });
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Server Error"});
  }
});

// 3. Verify breach OTP
app.post("/api/verify-breach", async (req, res) => {
  try {
    const { email, otp, alertId } = req.body;
    if (!email || !otp) return res.status(400).json({message: "Email and OTP required"});

    const employee = await allEmployeeModel.findOne({email});
    if (!employee) return res.status(404).json({message: "User not found"});

    const OTPDoc = await otpModel.findOne({userId: employee._id }).sort({ _id: -1 });
    if (!OTPDoc) return res.status(400).json({message: "OTP Expired"});

    const verifyOTP = await bcrypt.compare(otp, OTPDoc.otp);
    if (!verifyOTP) return res.status(400).json({message: "Invalid OTP"});

    // Resolve the alert
    if (alertId) {
      const alert = await alertModel.findById(alertId);
      if (alert) {
        alert.status = "Resolved";
        alert.detail = "OTP verified successfully.";
        await alert.save();
      }
    } else {
      // Find latest pending if no explicit ID passed
      const alert = await alertModel.findOne({ userEmail: email }).sort({ _id: -1 });
      if (alert && alert.status === "Pending") {
         alert.status = "Resolved";
         alert.detail = "OTP verified successfully.";
         await alert.save();
      }
    }

    res.status(200).json({ message: "Breach Verified & Cleared" });
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Server Error"});
  }
});

// 4. Admin GET live locations
app.get("/api/admin/employee-locations", async (req, res) => {
  try {
    const locations = await locationLogModel.find({});
    // Convert to structure expected by frontend map
    const mapped = locations.map(l => ({
      id: l.userEmail,
      name: l.userName,
      role: l.userRole,
      lat: l.lat,
      lng: l.lng,
      status: l.status,
      punchIn: l.punchInTime || "-",
      location: l.punchInLocation || "-"
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Server Error"});
  }
});

// 5. Admin GET live alerts
app.get("/api/admin/alerts", async (req, res) => {
  try {
    const alerts = await alertModel.find({}).sort({ createdAt: -1 });
    
    // Auto-escalate expired pendings
    const now = new Date();
    for (let alert of alerts) {
       if (alert.status === "Pending" && now > alert.expiresAt) {
          alert.status = "Alarm";
          alert.detail = "OTP Verification Timeout";
          await alert.save();
       }
    }
    
    // Read mapped
    const mappedAlerts = alerts.map(a => {
       // calculate remaining seconds
       const remaining = a.expiresAt ? Math.max(0, Math.floor((new Date(a.expiresAt) - new Date()) / 1000)) : 0;
       
       let type = "alarm";
       if (a.status === "Resolved") type = "resolved";
       else if (a.status === "Alarm") type = "alarm";

       return {
         id: a._id.toString(),
         type: type,
         status: a.status,
         user: a.userName || "Unknown",
         empId: a.userEmail,
         event: a.eventType || "Geofence Breach",
         detail: a.detail,
         countdown: remaining,
         read: a.status !== "Alarm",
         createdAt: a.createdAt
       };
    });
    
    res.status(200).json(mappedAlerts);
  } catch (error) {
    console.error(error);
    res.status(500).json({message: "Server Error"});
  }
});

// 5b. Admin resolves an alert
app.put("/api/admin/alerts/:id/resolve", async (req, res) => {
  try {
    const alert = await alertModel.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    alert.status = "Resolved";
    alert.detail = "Manually resolved by admin.";
    await alert.save();
    res.status(200).json({ message: "Alert resolved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 6. Admin stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalEmployees = await allEmployeeModel.countDocuments({});
    const totalGeofences = await geofenceModel.countDocuments({ active: true });
    
    // OTPs sent today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const otpSentToday = await otpModel.countDocuments({ createdAt: { $gte: startOfToday } });
    
    // Active location logs (employees who sent location)
    const activeDevices = await locationLogModel.countDocuments({});
    
    // Active breaches
    const activeBreaches = await alertModel.countDocuments({ status: "Alarm" });
    
    res.status(200).json({
      totalEmployees,
      totalGeofences,
      otpSentToday,
      activeDevices,
      activeBreaches
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 7. Geofences CRUD
// GET all geofences
app.get("/api/admin/geofences", async (req, res) => {
  try {
    const geofences = await geofenceModel.find({}).sort({ createdAt: 1 });
    res.status(200).json(geofences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// POST create a new geofence
app.post("/api/admin/geofences", async (req, res) => {
  try {
    const { name, lat, lng, radius, color, description } = req.body;
    if (!name || !lat || !lng || !radius) {
      return res.status(400).json({ message: "name, lat, lng, radius are required" });
    }
    const gf = await geofenceModel.create({ name, lat, lng, radius, color: color || "#3b82f6", description: description || "" });
    res.status(201).json(gf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// PUT update a geofence
app.put("/api/admin/geofences/:id", async (req, res) => {
  try {
    const { name, lat, lng, radius, color, description, active } = req.body;
    const gf = await geofenceModel.findByIdAndUpdate(
      req.params.id,
      { name, lat, lng, radius, color, description, active },
      { new: true, runValidators: true }
    );
    if (!gf) return res.status(404).json({ message: "Geofence not found" });
    res.status(200).json(gf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// DELETE a geofence
app.delete("/api/admin/geofences/:id", async (req, res) => {
  try {
    const gf = await geofenceModel.findByIdAndDelete(req.params.id);
    if (!gf) return res.status(404).json({ message: "Geofence not found" });
    res.status(200).json({ message: "Geofence deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 8. Delete employee
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const emp = await allEmployeeModel.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    // Clean up location logs
    await locationLogModel.deleteMany({ userEmail: emp.email });
    res.status(200).json({ message: "Employee deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ─── PROFILE UPDATE REQUEST ENDPOINTS ────────────────────────────────────────

// Employee submits an update request
app.post("/api/update-request", async (req, res) => {
  try {
    const { email, name, employeeId, role, password } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const employee = await allEmployeeModel.findOne({ email });
    if (!employee) return res.status(404).json({ message: "User not found" });

    // Check if there's already a pending request from this user
    const existing = await updateRequestModel.findOne({ userId: employee._id, status: "Pending" });
    if (existing) {
      return res.status(409).json({ message: "You already have a pending update request. Please wait for admin approval." });
    }

    const newReq = await updateRequestModel.create({
      userId: employee._id,
      userName: employee.name,
      userEmail: email,
      requestedData: { name, email, employeeId, role, password }
    });

    res.status(201).json({ message: "Update request submitted. Awaiting admin approval.", requestId: newReq._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Admin fetches all PENDING update requests
app.get("/api/admin/update-requests", async (req, res) => {
  try {
    const requests = await updateRequestModel.find({ status: "Pending" }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Admin approves a request → apply changes to employee
app.put("/api/admin/update-requests/:id/approve", async (req, res) => {
  try {
    const request = await updateRequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") return res.status(400).json({ message: "Request already processed" });

    const employee = await allEmployeeModel.findById(request.userId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const { name, email, employeeId, role, password } = request.requestedData;

    // Apply non-sensitive fields
    if (name)       employee.name = name;
    if (email)      employee.email = email;
    if (employeeId) employee.EmployeeId = employeeId;
    if (role)       employee.role = role;

    // Hash and apply password only on admin approval
    if (password && password.trim() !== "") {
      const saltRounds = 6; // Fast hashing for free tier
      const hashed = await bcrypt.hash(password, saltRounds);
      employee.password = hashed;
    }

    await employee.save();

    request.status = "Approved";
    request.adminNote = req.body?.note || "Approved by admin";
    await request.save();

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Admin rejects a request
app.put("/api/admin/update-requests/:id/reject", async (req, res) => {
  try {
    const request = await updateRequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") return res.status(400).json({ message: "Request already processed" });

    request.status = "Rejected";
    request.adminNote = req.body?.note || "Rejected by admin";
    await request.save();

    res.status(200).json({ message: "Request rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ─── LEAVE REQUEST ENDPOINTS ────────────────────────────────────────

// 1. Employee submits a leave request
app.post("/api/leave-request", async (req, res) => {
  try {
    const { email, requestType, startDate, endDate, reason } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const employee = await allEmployeeModel.findOne({ email });
    if (!employee) return res.status(404).json({ message: "User not found" });

    const newReq = await leaveRequestModel.create({
      userId: employee._id,
      userName: employee.name,
      userEmail: email,
      requestType,
      startDate,
      endDate,
      reason
    });

    res.status(201).json({ message: "Leave request submitted.", requestId: newReq._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 2. Fetch leave requests for a single employee
app.get("/api/employee/leave-requests/:email", async (req, res) => {
  try {
    const requests = await leaveRequestModel.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 3. Admin fetches all leave requests
app.get("/api/admin/leave-requests", async (req, res) => {
  try {
    const requests = await leaveRequestModel.find({}).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 4. Admin approves a leave request
app.put("/api/admin/leave-requests/:id/approve", async (req, res) => {
  try {
    const request = await leaveRequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = "Approved";
    request.adminNote = req.body?.note || "Approved by Admin";
    await request.save();

    res.status(200).json({ message: "Request approved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// 5. Admin rejects a leave request
app.put("/api/admin/leave-requests/:id/reject", async (req, res) => {
  try {
    const request = await leaveRequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = "Rejected";
    request.adminNote = req.body?.note || "Rejected by Admin";
    await request.save();

    res.status(200).json({ message: "Request rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
})
