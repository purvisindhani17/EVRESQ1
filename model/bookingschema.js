const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    name: { type: String},
    phoneNumber: { type: String},
    vehicleNumber: { type: String, required: true},
    currentLocation:{type:String,required:true},
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    isaccepted:{ type: Boolean ,default:false},
    acceptedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',  
    },status: {
        type: String,
        enum: ['Pending', 'Completed', 'Cancelled'], 
        default: 'Pending' 
    },
    destinationReached: {
        type: Boolean,
        default: false 
    },
    chargingCompleted: {
        type: Boolean,
        default: false 
    },
    paymentReceived: {
        type: Boolean,
        default: false 
    }
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
