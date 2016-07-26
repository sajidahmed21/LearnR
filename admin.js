/* This file handles all web service requests required by admins
   (including analytics) */

var common = require('./common');

/* Function for sending JSON response with 400 `Bad Request` status code */
var sendBadRequestResponse = common.sendBadRequestResponse;

/* Function for sending JSON response 401 `Unauthorized` status code */
var sendUnauthorizedResponse = common.sendUnauthorizedResponse;

/* Common instance of `sequelize` */
var db = common.db;


/* To be called as a part of a chain in the routing.
 *
 * Calls the `next` function if the admin is logged in and otherwise renders
 * the Admin Login page
 */
exports.checkAuthentication = function(request, response, next) {

    // Check if the adminId is set, meaning that the user is logged in and is active
    if (request.session.adminId !== undefined && request.session.adminId !== 0) {
        next();
    }
    else {
        // Render admin login page if admin is not logged in
        response.render('admin_login');
    }
};

/* Renders the admin home page */
exports.handleAdminHomeRequest = function (request, response) {
    response.render('admin_home');
};


/* Handles login requests by validating input and verifying username and password */
exports.handleLoginRequest = function(request, response) {
    var username = request.body.admin_id;
    var password = request.body.password;
    
    if (username === undefined || password === undefined) {
        /* Return login failed response if username or password
           fields are missing */
        sendMalformedRequestResponse('Missing field', response);
        return;
    }
    
    // TODO: Correct length check
    if (username.length === 0 || password.length === 0) {
        /* Return login failed response if username or password
           fields are of incorrect length */
        sendMalformedRequestResponse('Incorrect field length', response);
        return;
    }
    
    /* Find the admin profile with the given username */
    var queryString = 'SELECT * FROM ADMIN_CREDENTIALS WHERE username = $1';
    db.query(queryString, {bind: [username]}).spread(function(results) {
        
        if (results === undefined || results.length !== 1) {  // Username doesn't exist
            sendInvalidCredentialsResponse(response);
            return;
        }
        var admin = results[0];
        
        // Check if password is correct
        if (common.comparePassword(password, admin.password)) { // Correct password
            // --- Successful login ---
            onSuccessfulLogin(username, request, response);
        }
        else { // Incorrect password
            sendInvalidCredentialsResponse(response);
        }
    });
};

/*  Handles logout requests by resetting Admin Id for the particular session
 *  and redirecting to the admin login page
 */
exports.handleLogoutRequest = function (request, response) {
    // Reset Admin Id to indicate this session is no longer associated with any admin
    request.session.adminId = undefined;
    
    // Redirect to Admin Login Page
    common.redirectToPage('/admin', response);
};


/* Hanldes edit user profile requests by rendering the edit user profile page for admins */
exports.handleEditProfileRequest = function (request, response) {
    response.render('edit_user_profile_admin');
};

/* Handles edit course requests by rendering the edit course page for admins */
exports.handleEditCourseRequest = function (request, response) {
    response.render('edit_course_admin');
};


function sendMalformedRequestResponse(message, response) {
    var responseBody = {status: 'LOGIN_FAILED', 'message': message};
    sendBadRequestResponse(responseBody, response);
}

function sendInvalidCredentialsResponse(response) {
    var responseBody = {status: 'LOGIN_FAILED', message: 'Invalid credentials'};
    sendUnauthorizedResponse(responseBody, response);
}

function onSuccessfulLogin(adminId, request, response) {
    // Set the associated adminId for this session
    request.session.adminId = adminId;
    
    // Redirect to Admin Home Page
    common.redirectToPage('/admin', response);
}


/* --- Analytics --- */

/* Handles analytics data requests by providing analytics data about users and classes */
exports.handleAnalyticsDataRequest = function (request, response) {
    
    /* --- SQL Queries --- */
    
    /* Total number of users */
    var totalUsers = '(SELECT COUNT(*) AS totalUsers FROM USERS)';
    
    /* Number of unique users who have enrolled for at least one class */
    var usersEnrolledInClass = '(SELECT COUNT(DISTINCT user_id) AS numUsersEnrolledInClass FROM ENROLMENT)';
    
    /* Avg num of unique users per day */
    var avgLogins = '(SELECT COALESCE(AVG(numLogins), \'-\') AS avgUniqueLoginsPerDay ' +
                     'FROM (SELECT COUNT(DISTINCT user_id) AS numLogins FROM LOGIN_HISTORY GROUP BY date(login_timestamp)))';
    
    /* Total number of classes */
    var numClasses = '(SELECT COUNT(*) AS numClasses FROM CLASSES)';
    
    /* Avg num of users per class */
    var avgUsersPerClass = '(SELECT COALESCE((SELECT COUNT(*) FROM ENROLMENT) / (SELECT COUNT(*) FROM CLASSES), \'-\') ' +
                            'AS avgUsersPerClass)';
    
    /* Avg rating over all classes */
    var avgClassRating = '(SELECT (COALESCE(AVG(rating), \'-\')) AS avgClassRating FROM REVIEWS)';
    
    /* The final query to be passed in for execution */
    var finalQuery = 'SELECT * FROM ' + totalUsers + ', ' + usersEnrolledInClass + ', ' + avgLogins + ', ' +
                      numClasses + ', ' + avgUsersPerClass + ', ' + avgClassRating;
    
    db.query(finalQuery).spread(function (results) {
        if (results === undefined || results.length !== 1) {
            // We shouldn't get here
            common.sendInternalServerErrorResponse(response);
            return;
        }
        
        // Send the JSON response back to the client
        common.sendBackJSON(results[0], response);
    });
};