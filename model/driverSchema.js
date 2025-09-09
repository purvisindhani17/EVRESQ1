const mongoose = require("mongoose");
const passportlocalmongoose=require('passport-local-mongoose');

const driverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phoneNumber: { type: String, required: true, unique: true },
    vehicleNumber: { type: String, required: true, unique: true },
    licenseNumber: { type: String, required: true, unique: true },
    preferredLocation: { type: String, required: true },
});

driverSchema.plugin(passportlocalmongoose, { usernameField: 'email' });
const Driver = mongoose.model("Driver", driverSchema);
module.exports = Driver;