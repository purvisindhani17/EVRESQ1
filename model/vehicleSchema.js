const mongoose = require('mongoose');
const passportlocalmongoose=require('passport-local-mongoose');
const vehicleSchema = new mongoose.Schema({
    name: { 
        type: String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phoneNumber: {
         type: Number,
         required:true
    },
    vehicleType: {
        type: String,
        required: true,
        enum: ['Car', 'Bike', 'Scooter', 'Bus'] 
    },
    makeModel: {
        type: String,
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true,
        unique: true
    },
    batteryCapacity: {
        type: String,
        required: true
    },
    insurance: {
        type: String, 
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


vehicleSchema.plugin(passportlocalmongoose, { usernameField: 'email' });
module.exports = mongoose.model('Vehicle', vehicleSchema);