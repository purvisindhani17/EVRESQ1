if(process.env.NODE_ENV !=="production"){
    require('dotenv').config();
}
const express=require('express');
const mongoose= require('mongoose');
const path=require('path');
const joi=require('joi');
const session=require('express-session');
const flash=require('connect-flash');
const passport=require('passport');
const localstrategy=require('passport-local').Strategy;
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' });
const bodyParser=require('body-parser');
const ejsmate=require('ejs-mate');
const methodoverride=require('method-override');
const catchasync=require('./utilities/catchasync');
const expresserror=require('./utilities/expresserror');
const { checkAuth } = require('./middleware');
const Driver=require('./models/driverSchema');
const Vehicle=require('./models/vehicleSchema');
const Booking=require('./models/bookingSchema');


const app=express();
const secret = process.env.SECRET || 'thisshouldbeabettersecret!';
const dburl = process.env.DB_URL || 'mongodb://127.0.0.1:27017/evresq';


mongoose.connect(dburl);
main().catch(err => console.log(err));
async function main() {
  await mongoose.connect(dburl);
   console.log("connection made");
}
const MongoDBStore=require('connect-mongo');
const store = new MongoDBStore({
    mongoUrl: dburl,
    secret,
    touchAfter: 24 * 60 * 60
});
store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})
store.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});
  

const sessionconf = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(express.json()); 
app.use(session(sessionconf));
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');
app.engine('ejs',ejsmate);
app.use(express.urlencoded({extended:true}));
app.use(methodoverride('_method'))
app.use(express.static(path.join(__dirname,'public')))
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use('vehicle-local', new localstrategy({
    usernameField: 'email',
    passwordField: 'password'
}, Vehicle.authenticate()));
passport.use('driver-local', new localstrategy({
    usernameField: 'email',
    passwordField: 'password'
}, Driver.authenticate()));


passport.serializeUser((user, done) => {
    done(null,user._id);  
});
passport.deserializeUser(async (obj, done) => {
    try {
        const driver = await Driver.findById(obj);
        if (driver) return done(null, driver);
        
        const vehicle = await Vehicle.findById(obj);
        if (vehicle) return done(null, vehicle);
        
        done(new Error("User not found"));
    } catch (err) {
        done(err);
    }
});


app.use((req,res,next)=>{
    res.locals.currentuser=req.user;
    res.locals.success=req.flash('success');
    res.locals.error=req.flash('error');
    next();
});

app.get('/',catchasync(async (req,res)=>{
    res.render('home');
}));
app.get('/option',catchasync(async(req,res)=>{
    res.render('option')
}));


// Owner routes
app.get('/dashboard2',checkAuth,catchasync(async(req,res)=>{
    console.log("Session before rendering dashboard:", req.session);
    if (!req.session.user || req.session.user.role !== 'Vehicle') {
        req.flash('error', 'Please log in first');
        return res.redirect('/evdetailslogin');
    }
    const vehicleOwner = await Vehicle.findById(req.session.user.id);
    if (!vehicleOwner) {
        req.flash('error', 'Vehicle owner not found.');
        return res.redirect('/evdetailslogin');
    }
    res.render('owner/dashboard2', { vehicleOwner });
}));
app.post('/dashboard2',checkAuth,catchasync(async(req,res)=>{
    res.render('owner/requestbooking')
}));
app.get('/requestbooking',checkAuth,catchasync(async(req,res)=>{
    res.render('owner/requestbooking')
}));
app.post('/requestbooking', checkAuth,catchasync(async (req, res) => {
    try {
        const { currentLocation,currentLocationManual} = req.body;
        const userId = req.session.user ? req.session.user.id : null; // Get user ID from session
        if (!userId) {
            req.flash('error', 'You must be logged in to make a booking.');
            return res.redirect('/evdetailslogin'); // Redirect to login if not logged in
        }
        console.log("User  ID from session:", userId);
        const owner = await Vehicle.findById(userId); // Assuming the user is the vehicle owner
        console.log("Owner found:", owner);
        if (!owner) {
            req.flash('error', 'Vehicle not found. Please register the vehicle.');
            return res.redirect('/requestbooking');
        }

        const { name, phoneNumber, vehicleNumber } = owner;
        const locationToUse = currentLocation || currentLocationManual; // Use either current location or manual input

        const newBooking = new Booking({
            name,
            phoneNumber,
            vehicleNumber,
            currentLocation: locationToUse,
            vehicleId: owner._id  
        });
        /*
        const { name, phoneNumber, vehicleNumber } = owner;
        const newBooking = new Booking({
            name,
            phoneNumber,
            vehicleNumber,
            currentLocation,
            vehicleId: owner._id  
        });
        */
        newBooking.status='Pending';
        newBooking.isaccepted=false;
        await newBooking.save();
        req.flash('success', 'Booking successful');
        return res.redirect(`/coming/${newBooking._id}`);
    } catch (e) {
        console.log(e);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/requestbooking');
    }
}));
app.get('/coming/:id',checkAuth, catchasync(async (req, res) => {
    const { id } = req.params;  // Extract the booking ID
    try {
        const booking = await Booking.findById(id).populate('acceptedby');
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard2');
        }
        res.render('owner/coming', { booking }); // Render with booking details
    } catch (error) {
        console.error("Error fetching booking:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard2');
    }
}));
app.get('/driverdetails/:id/:bookingId',checkAuth, catchasync(async (req, res) => {
    const { id, bookingId} = req.params;
    try {
        const driver = await Driver.findById(id);
        const booking = await Booking.findById(bookingId)
        if (!driver) {
            req.flash('error', 'Driver not found');
            return res.redirect('/dashboard2');
        }
        res.render('owner/driverdetails', { driver,booking });
    } catch (error) {
        console.error("Error fetching driver:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard2');
    }
}));
app.post('/driverdetails/:id/:bookingId', checkAuth,catchasync(async (req, res) => {
    const { id,bookingId } = req.params;
    try {
        const driver = await Driver.findById(id);
        const booking= await Booking.findById(bookingId)
        if (!driver) {
            req.flash('error', 'Driver not found');
            return res.redirect('/dashboard2');
        }
        res.render('owner/driverdetails', { driver, booking});
    } catch (error) {
        console.error("Error fetching driver:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard2');
    }
}));
app.post('/completeBooking/:id',checkAuth, catchasync(async (req, res) => {
    const { id } = req.params; 
    try {
        const updatedBooking = await Booking.findByIdAndUpdate(
            id,
            {
                status: 'Completed',
                isaccepted: true,  
                acceptedby: null   
            },
            { new: true } 
        );
        if (!updatedBooking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard2'); 
        }
        req.flash('success', 'Thank You hope you had a great experience!');
        return res.redirect('/');   
    } catch (error) {
        console.error("Error completing booking:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard2'); 
    }
}));
app.get('/ownerprofile',checkAuth,catchasync(async(req,res)=>{
    const vehicleId = req.session.user ? req.session.user.id : null;
    const owner= await Vehicle.findById(vehicleId)
    res.render('owner/ownerprofile',{owner})
}));


// Driver routes
app.get('/dashboard1',checkAuth, catchasync(async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'Driver') {
        req.flash('error', 'Please log in first');
        return res.redirect('vehicledetailslogin');
    }
    const driver = await Driver.findById(req.session.user.id);
    const bookings = await Booking.find({ isaccepted: false });
    res.render('driver/dashboard1', { driver, bookings });
}));
app.post('/dashboard1', checkAuth,catchasync(async (req, res) => {
    try {
        // Yahan tumhara dashboard ka logic aayega
        res.send("Dashboard Route Working");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}));
app.post('/accept-booking/:bookingId',checkAuth, catchasync(async (req, res) => {
    try {
        const { bookingId } = req.params;
        // Check if the driver is logged in
        const driverId = req.session.user ? req.session.user.id : null; // Get driver ID from session
        if (!driverId) {
            req.flash('error', 'You must be logged in as a driver to accept bookings.');
            return res.redirect('/vehicledetails'); // Redirect to driver login if not logged in
        }
        const driver = await Driver.findById(driverId);
        if (!driver) {
            req.flash('error', 'No driver found with this ID.');
            return res.redirect('/dashboard1');
        }
        const updatedBooking = await Booking.findByIdAndUpdate(
            bookingId,
            { 
                isaccepted: true,
                acceptedby: driver._id  // Assign driver ID
            },
            { new: true }
        );
        if (!updatedBooking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard1'); 
        }
        const customerId = updatedBooking.vehicleId; // Assuming customerId is stored in the booking
        req.flash('success', 'Booking accepted successfully');
        res.redirect(`/customerdetails/${customerId}/${bookingId}`);
    } catch (error) {
        console.error("Error accepting booking:", error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/dashboard1'); // Redirect to dashboard on error
    }
}));
app.get('/customerdetails/:customerId/:bookingId',checkAuth,catchasync(async (req, res) => {
    const { customerId } = req.params;
    const {bookingId}=req.params;
    try {
        const customer = await Vehicle.findById(customerId); // Assuming you have a Customer model
        const booking=await Booking.findById(bookingId);
        if (!customer) {
            req.flash('error', 'Customer not found');
            return res.redirect('/dashboard1'); // Redirect to a safe page if customer not found
        }
        res.render('driver/customerdetails', { customer,booking}); // Render the customer details page
    } catch (error) {
        console.error("Error fetching customer details:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard1'); // Redirect to a safe page on error
    }
}));
app.post('/complete-booking/:bookingId', checkAuth,catchasync(async (req, res) => {
    const { destinationReached, chargingCompleted, paymentReceived } = req.body;
    const{ bookingId }=req.params;
    try {
        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
            status: 'Completed', // Update the status
            destinationReached: destinationReached ? true : false,
            chargingCompleted: chargingCompleted ? true : false,
            paymentReceived: paymentReceived ? true : false,
        }, { new: true });
        if (!updatedBooking) {
            req.flash('error', 'Booking not found.');
            return res.redirect('/dashboard1'); // Redirect to a safe page
        }
        req.flash('success', 'Thank you! We hope you had a good experience.');
        return res.redirect('/'); // Redirect to the dashboard or another page
    } catch (error) {
        console.error("Error updating booking:", error);
        req.flash('error', 'Internal Server Error');
        return res.redirect('/dashboard1'); // Redirect to a safe page on error
    }
}));
app.get('/driverprofile',checkAuth,catchasync(async(req,res)=>{
    const driverId = req.session.user ? req.session.user.id : null;
    const driver= await Driver.findById(driverId)
    res.render('driver/driverprofile',{driver})
}));



// register routes
app.get('/evdetails',catchasync(async(req,res)=>{
    res.render('owner/evdetails');
}));
app.get('/vehicledetails',catchasync(async(req,res)=>{
    res.render('driver/vehicledetails');
}));
app.post('/evdetails', upload.single('insurance'),catchasync(async(req,res)=>{
    try {
        const { name, email, phoneNumber, vehicleType, makeModel, vehicleNumber, batteryCapacity, password } = req.body;
        const insuranceFile = req.file ? req.file.filename : null;
        const newVehicle= new Vehicle({ name, email, phoneNumber, vehicleType, makeModel, vehicleNumber, batteryCapacity, insuranceFile });
        await Vehicle.register(newVehicle, password);
        console.log("New Vehicle Registered:", newVehicle);
        req.login(newVehicle, (err) => {
            if (err) {
                req.flash('error', 'Login failed after registration.');
                return res.redirect('/evdetails');
            }
            // Set session variables if needed
            req.session.user = { id: newVehicle._id, role: 'Vehicle' }; // Store user ID and role in session
            console.log("Session after registration:", req.session);
            req.flash('success', 'Registration successful! Welcome to your dashboard.');
            return res.redirect('/dashboard2'); // Redirect to the dashboard
        });
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/evdetails');
    }
}));
app.post('/vehicledetails', catchasync(async (req, res) => {
    try {
        const { name, email, phoneNumber, licenseNumber, vehicleNumber, preferredLocation, password } = req.body;
        const newDriver = new Driver({ name, email, phoneNumber, licenseNumber, vehicleNumber, preferredLocation });
        await Driver.register(newDriver, password);
        req.login(newDriver, (err) => {
            if (err) {
                req.flash('error', 'Login failed after registration.');
                return res.redirect('/vehicledetails');
            }
            req.session.user = { id: newDriver._id, role: 'Driver' }; // Store user ID and role in session
            console.log("Session after registration:", req.session);
            req.flash('success', 'Registration successful! Welcome to your dashboard.');
            return res.redirect('/dashboard1'); // Redirect to the dashboard
        });
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/vehicledetails');
    }
}));



// login routes
app.get('/evdetailslogin',catchasync(async(req,res)=>{
    res.render('owner/evdetailslogin');
}))
app.get('/vehicledetailslogin',catchasync(async(req,res)=>{
    res.render('driver/vehicledetailslogin');
}))
app.post('/evdetailslogin', passport.authenticate('vehicle-local', { 
    failureFlash: true, 
    failureRedirect: '/evdetailslogin' 
}), (req, res) => {
    console.log("User  logged in:", req.user);
    req.session.user = { id: req.user._id, role: 'Vehicle' };  // Store role in session
    console.log("Session after login:", req.session);
    res.redirect('/dashboard2');
});
app.post('/vehicledetailslogin', passport.authenticate('driver-local', { 
    failureFlash: "Username or Password is incorrect", 
    failureRedirect: '/vehicledetailslogin' 
}), (req, res) => {
    console.log("User logged in:", req.user);
    req.session.user = { id: req.user._id, role: 'Driver' };  // Store role in session
    console.log("Session after login:", req.session);
    res.redirect('/dashboard1');
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash('success', 'Logged out successfully');
        res.redirect('/');
    });
});
app.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash('success', 'Logged out successfully');
        res.redirect('/');
    });
});

app.get('/contact',(req,res)=>{
    res.render('./contact');
});

app.all('*',(req,res,next)=>{
    next(new expresserror('Page Not Found',404));
})


const port = process.env.PORT || 8000; 

app.listen(port, () =>{
    console.log(`serving on port ${port}`);
});


