module.exports.checkAuth=(req,res,next)=>{
    if (req.isAuthenticated() && (req.session.user.role === 'Vehicle' || req.session.user.role === 'Driver')) {
        return next(); 
    }
    req.flash('error', 'Please log in first');
    return res.redirect('/evdetailslogin'); 
}