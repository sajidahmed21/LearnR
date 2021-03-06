var express = require('express');
var app = express();

// Denial of Service module for too many requests from a particular client
var ddosModule = require('ddos');
// allow 200 requests per minute, with no more than 12 at a given time
var ddos = new ddosModule({
    limit: 200,
    burst: 24,
    maxexpiry: 60,
    errormessage: 'Oh no! You\'ve been making too many requests and have been blocked.',
});
app.use(ddos.express);


//will cache compiled templates, and 
//only recompile and recache when template changes
// improves performance
app.set('view cache', true);

var bcrypt = require('bcryptjs');

// other modules
var fs = require('fs');

// google authentication
var googleLogin = require('./googleLogin');
var passport = require('passport');
var googleStrategy = require('passport-google-oauth20').Strategy;

/* serialising and deserialising are used to store information, but since
 * we are transfering the data to internal columns, we don't need to do anything */
passport.serializeUser(function (user, done) {
    console.log('serialising');
    done(null, user);
});


passport.deserializeUser(function (obj, done) {
    console.log('deserialising');
    done(null, obj);
});

passport.use(new googleStrategy({
        clientID: '640017624415-meb3upiuuvfktulov25iuo26gjgejti2.apps.googleusercontent.com',
        clientSecret: 'APx9gK5DrCyjPqS3M4aI8fJV',
        callbackURL: "https://csc309-learnr.herokuapp.com/auth/google/callback"
    },
    function (accessToken, refreshToken, profile, callback) {
        console.log('fetching user');
        googleLogin.findOrCreateUser(profile, function (err, userId) {
            if (err) {
                console.log('error in findOrCreateUser()');
                return callback(err, profile);
            } else {
                // we should have a valid userId now available
                console.log('findOrCreateUser() returned successfully');
                return callback(null, profile);
            }
        });
    }));

app.use(passport.initialize());

// socket.io for messaging
var server = require('http').Server(app);
var socketIO = require('socket.io')(server);
global.socketIO = socketIO;


// shared session management between regular requests and socket.io ones
var session = require('express-session')({
    secret: 'Any Secret - I dont know',
    resave: true,
    saveUninitialized: true,
    rolling: true
});
var sharedSession = require("express-socket.io-session");

app.use(session);
app.use(passport.session());


socketIO.use(sharedSession(session, {
    secret: 'Any Secret - I dont know',
    resave: true,
    saveUninitialized: true
}));

var helmet = require('helmet');
app.use(helmet.xssFilter());
app.use(helmet.hsts({
    maxAge: 7776000000,
    includeSubdomains: true
}));

// set hostname and port here
var hostname = 'localhost';
var port = 3000;
var expressValidator = require('express-validator')
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer({
    dest: 'uploads/'
}); // for parsing multipart/form-data

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


// custom modules
var notifications = require('./notifications');
var recommendations = require('./recommendations');
var messaging = require('./messaging');
var user = require('./user');
var followings = require('./followings');
var searchEngine = require('./searchEngine');
var courses = require('./courses');
var admin = require('./admin');
var createcourse = require('./createcourse');
var renderHome = require('./home').render;

var common = require('./common');
var sendBackJSON = common.sendBackJSON;
var db = common.db;
var checkAuthentication = common.checkAuthentication;
var getLoggedInUserId = common.getLoggedInUserId;
var userIsLoggedIn = common.userIsLoggedIn;

// handlebars setup
var exphbs = require('express-handlebars');
var hbs = exphbs.create({
    defaultLayout: false
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// set public directory for css, js, and imgs
app.use(express.static(__dirname + '/public'));


/* page routing -----------------------------------------------------*/
app.get('/', renderHome);


/* Courses ----------------------------------------------------------*/

app.post('/course/enroll', checkAuthentication, courses.enrollHandler);
app.delete('/course/unenroll', checkAuthentication, courses.unenrollHandler);
app.post('/submitpost', courses.checkLoggedIn, courses.classExists, courses.isInstructor);
app.get('/course/:id',
    courses.get_class_info,
    courses.get_course_rating,
    courses.get_enrolled_students,
    courses.get_reviews,
    courses.get_posts,
    courses.hasLoggedInUserReviewed,
    courses.isLoggedInUserInstructor,
    courses.isLoggedInUserEnrolled,
    courses.getLoggedInUserAvatar,
    courses.render_course_page);

app.get('/createcourse', checkAuthentication, function (req, res) {
    // if logged in render page 
    // otherwise display page that says the user must be signed in to create a course. 
    res.render('createcourse', {
        loggedIn: userIsLoggedIn(req),
        courseBannerErr: '',
        courseReqs: '',
        courseDesc: '',
        courseTitle: '',
    });
});

app.post('/editcoursedesc', checkAuthentication, courses.editCourseDescHandler);
app.post('/editcoursereqs', checkAuthentication, courses.editCourseReqsHandler);

var upload = multer({
    dest: __dirname + '/public/img/'
}).single('courseBanner');
app.post('/createcourse', checkAuthentication, function (req, res, next) {
    upload(req, res, function (err) {
        res.courseBannerErr = '';
        res.courseTitleErr = '';
        res.courseDescErr = '';
        res.courseReqsErr = '';
        if (err) {
            console.log("something went wrong with file upload");
            return;
        } else {
            console.log(req.file);
            if (!req.file) // undefined, use default path 
                res.bannerpath = "/img/study.jpg";
            else {
                res.bannerpath = "/img/" + req.file.filename;
            }
            // replace 1 with id of logged in user
            console.log("res.bannerpath in server: " + res.bannerpath);
            next();
        }
    })
}, createcourse.validate, checkAuthentication, createcourse.addClassInfoAndRedirect);

app.post('/submitreview', checkAuthentication, function(req, res, next) {
        // do some validation
    var data = req.body;
    var user_id = getLoggedInUserId(req);
    var class_id = data.class_id;
    var content = data.review;
    var rating = data.rating;
    db.query('INSERT INTO REVIEWS (user_id, class_id, content, rating) VALUES ($1, $2, $3, $4)', 
    { bind: [user_id, class_id, content, rating]}
    ).then(function(rows) {
            res.end('{"success" : "Updated Successfully", "status" : 200}');
    })
    .catch(function(err) {
        console.log("query failed");
        res.status(500);
        res.end();
    });
});



/* Users ------------------------------------------------------------*/



app.post('/user/signin', function (req, res) {
    user.signinHandler(req, res, undefined);
});

app.post('/user/signup', user.signupHandler);

app.post('/user/changeprofilepic', checkAuthentication, user.changeProfilePicHandler);

app.post('/user/changename', checkAuthentication, user.changeNameHandler);

app.post('/user/changepassword', checkAuthentication, user.changePasswordHandler);

app.post('/user/follow', checkAuthentication, followings.followHandler);

app.post('/user/unfollow', checkAuthentication, followings.unfollowHandler);

app.get('/user/profile', checkAuthentication, function (req, res) {
    user.getProfileHandler(req, res, getLoggedInUserId(req));
});

app.get('/user/profile/:id', checkAuthentication, function (req, res) {
    user.getProfileHandler(req, res, req.params.id);
});

app.post('/user/logout', user.logoutHandler);

app.post('/user/unenrollClasses', checkAuthentication, user.unenrollHandler);

app.post('/user/deleteuser', checkAuthentication, user.deleteUserHandler);

app.post('/user/stopTeaching', checkAuthentication, user.stopTeachingHandler);


/* Admins  ----------------------------------------------------------*/

app.get('/admin', admin.checkAuthentication, admin.handleAdminHomeRequest);

app.post('/admin/login', admin.handleLoginRequest);

app.get('/admin/logout', admin.handleLogoutRequest);

app.get('/admin/analytics', admin.checkAuthentication, admin.handleAnalyticsDataRequest);

app.post('/admin/create_user', admin.checkAuthentication, admin.handleCreateUserRequest);

app.get('/admin/edit_user_profile/:id', admin.checkAuthentication, admin.handleEditProfileRequest);

app.post('/admin/edit_user/name/:id', admin.checkAuthentication, admin.handleEditNameRequest);

app.post('/admin/edit_user/change_password/:id', admin.checkAuthentication, admin.handleChangePasswordRequest);

app.post('/admin/delete_user/:id', admin.checkAuthentication, admin.handleDeleteUserRequest);

app.post('/admin/remove_user_from_course/:id', admin.checkAuthentication, admin.handleUnenrolUserRequest);

app.post('/admin/delete_all_users', admin.checkAuthentication, admin.handleDeleteAllUsersRequest);

app.post('/admin/delete_all_classes', admin.checkAuthentication, admin.handleDeleteAllClassesRequest);

app.post('/admin/delete_course/:id', admin.checkAuthentication, admin.handleDeleteCourseRequest);

app.post('/admin/delete_review', admin.checkAuthentication, admin.handleDeleteReviewRequest);

app.get('/admin/edit_course/:id',
    admin.checkAuthentication,
    courses.get_class_info,
    courses.get_course_rating,
    courses.get_enrolled_students,
    courses.get_reviews,
    courses.get_posts,
    courses.hasLoggedInUserReviewed,
    courses.isLoggedInUserInstructor,
    courses.isLoggedInUserEnrolled,
    courses.getLoggedInUserAvatar,
    courses.render_course_page);


/* Searches  --------------------------------------------------------*/

app.get('/messaging', checkAuthentication, messaging.renderPage);


/* Searches  --------------------------------------------------------*/

app.get('/search', searchEngine.handleSearch);


/* socket io --------------------------------------------------------*/

socketIO.on('connection', messaging.onConnection);


/* google authentication --------------------------------------------*/

/* The request made to redirect to Google for authentication. */
app.get('/auth/google/',
    passport.authenticate('google', {
        scope: ['openid profile']
    }));

/* The request users are redirected to by Google after they have authenticated. */
app.get('/auth/google/callback',
    passport.authenticate('google'),
    function (req, res) {
        console.log('google user authenticated');

        // since we only have the googleId, convert it to an internal userId
        googleLogin.fetchUser(req.user.id, function (err, userId) {
            if (err) {
                renderHome(req, res, '<p><strong>Oh no!</strong> It doesn\' look like you succesfully logged in.</p>');
            } else {
                common.setLoggedInUserId(req, userId);
                console.log('logged in and redirected google user');
                // authenticated successfully and now logged in
                res.redirect('/user/profile');
            }
        })
    }
);


/* server start up --------------------------------------------------*/

server.listen(process.env.PORT || port, function () {
    console.log(`Server running at http://${hostname}:${port}/`);
});
