/* This file handles all web service requests required by admins
   (including analytics) */

var common = require('./common');
var user = require('./user');
var analytics = require('./analytics');

/* Common instance of `sequelize` */
var db = common.db;

/* For referencing functions from unit test files */
exports.test = {
    login: login,
    deleteAllUsers: deleteAllUsers,
    deleteAllClasses: deleteAllClasses,
    deleteReview: deleteReview,
    getUserProfileData: getUserProfileData
};


/* To be called as a part of a chain in the routing.
 *
 * Calls the `next` function if the admin is logged in and otherwise renders
 * the Admin Login page
 */
exports.checkAuthentication = function (request, response, next) {

    // Check if the adminId is set, meaning that the user is logged in and is active
    if (request.session.adminId !== undefined && request.session.adminId !== 0) {
        next();
    } else {
        // Render admin login page if admin is not logged in
        response.render('admin_login', {
            loginErrorMessage: request.session.loginErrorMessage // Show any pending error messages
        });
        request.session.loginErrorMessage = undefined;
    }
};

/* Renders the admin home page */
exports.handleAdminHomeRequest = function (request, response) {
    response.render('admin_home', {
        adminUsername: request.session.adminId,
        message: request.session.message,
        errorContent: request.session.errorContent
    });

    // Reset the error content and message once it has been displayed to the admin
    request.session.message = undefined;
    request.session.errorContent = undefined;
};


/* Handles login requests by validating input and verifying username and password */
exports.handleLoginRequest = function (request, response) {
    var username = request.body.admin_id;
    var password = request.body.password;
    
    login(username, password, request, response);
    
};


/* Logs in an admin with the given username */
function login(username, password, request, response, callback) {

    if (username === undefined || password === undefined) {
        /* Return login failed response if username or password
           fields are missing */
        if (callback !== undefined) {
           callback('Error: Missing required fields');
           return;
        }
        sendLoginFailedResponse('Oops! Something went wrong. Please try later', request, response);
        return;
    }


    if (username.length < 6 || password.length < 6) {
        /* Return login failed response if username or password
           fields are of incorrect length. This should not happen unless we have a malicious user */
        if (callback !== undefined) {
           callback('Error: Incorrect field length');
           return;
        }
        sendLoginFailedResponse('Oops! Something went wrong. Please try later', request, response);
        return;
    }

    /* Find the admin profile with the given username */
    var queryString = 'SELECT * FROM ADMIN_CREDENTIALS WHERE username = $1';
    db.query(queryString, {
        bind: [username]
    }).spread(function (results) {

        if (results === undefined || results.length !== 1) { // Username doesn't exist
            if (callback !== undefined) {
                callback('Login Failed: Invalid Credentials');
                return;
            }
            sendLoginFailedResponse('Login Failed: Invalid Credentials', request, response);
            return;
        }
        var admin = results[0];

        // Check if password is correct
        if (common.comparePassword(password, admin.password)) { // Correct password
            // --- Successful login ---
            if (callback !== undefined) {
                callback('Success');
                return;
            }
            
            onSuccessfulLogin(username, request, response);
        } else { // Incorrect password
            if (callback !== undefined) {
                callback('Login Failed: Invalid Credentials');
                return;
            }
            sendLoginFailedResponse('Login Failed: Invalid Credentials', request, response);
        }
    });
}

function sendLoginFailedResponse(message, request, response) {
    request.session.loginErrorMessage = message;
    common.redirectToPage('/admin', response);
}

/*  Handles logout requests by resetting Admin Id for the particular session
 *  and redirecting to the admin login page
 */
exports.handleLogoutRequest = function (request, response) {
    // Reset Admin Id to indicate this session is no longer associated with any admin
    request.session.adminId = undefined;

    // Redirect to Admin Login Page
    common.redirectToPage('/admin', response);
};

/* Handles all create user account request for admins by creating an user account
 * and redirecting to the appropriate page based on the result
 */
exports.handleCreateUserRequest = function (request, response) {
    var name = request.body.name;
    var username = request.body.username;
    var password = request.body.password;
    var passwordConfirmation = request.body.passwordConfirmation;

    user.createUser(name, username, password, passwordConfirmation, function (errorType, userId) {

        if (errorType === undefined) { // Account Successfully created
            request.session.message = '<p>Account successfully created</p>';
            common.redirectToPage('/admin/edit_user_profile/' + userId, response);
            return;
        }

        // Check error type and render web page with the appropriate message for the end user
        switch (errorType) {
        case 'Incorrect Password Length':
            request.session.errorContent = '<p><strong>Opps!</strong> Password must be between 6 and 20 characters</p>';
            common.redirectToPage('/admin', response);
            return;
        case 'Passwords Don\'t Match':
            request.session.errorContent = '<p><strong>Opps!</strong> The provided passwords do not match!</p>';
            common.redirectToPage('/admin', response);
            return;
        case 'Username Already Taken':
            request.session.errorContent = '<p><strong>Opps!</strong> This username has been taken! Please try a different username!</p>';
            common.redirectToPage('/admin', response);
            return;
        }

        // We shouldn't get here
        request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try later!</p>';
        common.redirectToPage('/admin', response);
    });
};


/* Hanldes edit user profile requests by rendering the edit user profile page for admins */
exports.handleEditProfileRequest = function (request, response) {

    getUserProfileData(request.params.id, function (status, profileData) {

        if (status == 'Success') {

            console.log(profileData.classes !== undefined && profileData.classes.length > 0);
            response.render('edit_user_profile_admin', {
                message: request.session.message,
                errorMessage: request.session.errorMessage,
                adminUsername: request.session.adminId,
                profile_name: profileData.profile_name,
                background_color: profileData.background_color,
                name: profileData.name,
                classes: profileData.classes,
                isEnrolledInClass: profileData.classes !== undefined && profileData.classes.length > 0,
                userId: request.params.id,
                isGoogleUser: profileData.isGoogleUser
            });
            // Reset messages after they have been rendered
            request.session.message = undefined;
            request.session.errorMessage = undefined;
        } else {
            // Show error message if the user could not be succssfully retrieve from the database.
            request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try again later!</p>';
            common.redirectToPage('/admin', response);
        }
    });
};

/* Handles name change requests by updating the name of the user in the database and providing
 * appropriate feedback on the front-end.
 */
exports.handleEditNameRequest = function (request, response) {
    var userId = request.params.id;

    user.changeName(request.params.id, request.body.newName, function (result) {
        switch (result) {
        case 'Success':
            request.session.message = '<p>Name updated</p>';
            break;
        case 'Invalid name':
            request.session.errorMessage = '<p>Oops! The name cannot be empty</p>';
            break;
        case 'Invalid user id':
            request.session.errorMessage = '<p>Oops! The user you are trying to edit does not exist!</p>';
            break;
        default:
            request.session.errorMessage = '<p>Oops! Something went wrong. Please try again later!</p>';
            break;
        }

        /* Redirect to the user profile page */
        common.redirectToPage('/admin/edit_user_profile/' + userId, response);
    });
};

exports.handleChangePasswordRequest = function (request, response) {
    var userId = request.params.id;

    // (userId, currentPassword, newPassword, newPasswordConfirm, isAdminChanging, callback)
    // We don't need to provided currentPassword since isAdminChanging = true
    user.changePassword(userId, undefined, request.body.newPassword, request.body.newPasswordConfirm, true, function (result) {

        switch (result) {
        case 'Success':
            request.session.message = '<p>Password changed</p>';
            break;

            // We should not get into the following error scenarios since we have client side validation as well
        case 'Invalid user id':
            request.session.errorMessage = '<p>Oops! Something went wrong. Please try again later!</p>';
            break;
        case 'Invalid new password':
            request.session.errorMessage = '<p>Oops! The new password you provided is invalid.</p>';
            break;
        case 'Passwords do not match':
            request.session.errorMessage = '<p>Oops! The new passwords do not match.</p>';
            break;
        }

        /* Redirect to the user profile page */
        common.redirectToPage('/admin/edit_user_profile/' + userId, response);
    });
};

exports.handleDeleteUserRequest = function (request, response) {

    user.deleteUser(request.params.id, function (result) {
        switch (result) {
        case 'Success':
            request.session.message = '<p>User has been deleted</p>';
            break;
        default:
            request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try later!</p>';
            break;
        }

        /* Redirect to the home page */
        common.redirectToPage('/admin', response);
    });
};

exports.handleUnenrolUserRequest = function (request, response) {
    var userId = request.params.id;

    user.unenrollUser(userId, request.body.courseId, function (result) {

        switch (result) {
        case 'Success':
            request.session.message = '<p>User has been removed from the selected course</p>';
            break;

            // We should not get here since we have validation on the client side
        default:
            request.session.errorMessage = '<p>Oops! Something went wrong. Please try again later!</p>';
            break;
        }

        /* Redirect to the user profile page */
        common.redirectToPage('/admin/edit_user_profile/' + userId, response);
    });
};

/* Handles edit course requests by rendering the edit course page for admins */
exports.handleEditCourseRequest = function (request, response) {
    response.render('edit_course_admin');
};


/* Handles delete course request by deleting a course and rendering appropriate message on the front end */
exports.handleDeleteCourseRequest = function (request, response) {

    deleteCourse(request.params.id, function (result) {
        if (result === 'Success') {
            request.session.message = '<p>Course has been deleted.</p>';
        } else {
            request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try later!</p>';
        }

        /* Redirect to the admin home page */
        common.redirectToPage('/admin', response);
    });
};

/* Handles delete course request by deleting a course and rendering appropriate message on the front end */
exports.handleDeleteReviewRequest = function (request, response) {

    deleteReview(request.body.courseId, request.body.userId, function (result) {
        var responseBody = {
            status: result
        };
        common.sendBackJSON(responseBody, response);
    });
};


/* Deletes the review with the given `courseId` and notifies about the result using the `callback` function */
function deleteReview(courseId, userId, callback) {
    if (courseId === undefined || userId === undefined) {
        callback('Missing required field');
        return;
    }

    if (courseId < 1 || userId < 1) {
        callback('Invalid id');
        return;
    }

    db.query("DELETE FROM REVIEWS WHERE user_id = $1 AND class_id = $2", {
        bind: [userId, courseId]
    }).spread(function () {
        callback('Success');
    }).catch(function () {
        callback('Error');
    });
}


/* Deletes the course with the given `courseId` and notifies about the result using the `callback` function */
function deleteCourse(courseId, callback) {
    if (courseId === undefined) {
        callback('Missing course id');
        return;
    }

    if (courseId < 1) {
        callback('Invalid course id');
        return;
    }

    db.query("DELETE FROM CLASSES WHERE id = $1", {
        bind: [courseId]
    }).spread(function () {
        callback('Success');
    }).catch(function () {
        callback('Error');
    });
}


/* Utility function that queries data about a users profile and their classes.
 * It provides the profile data back through the `callback` function.
 */
function getUserProfileData(profileUserId, callback) {
    if (profileUserId === undefined || profileUserId < 1) {
        callback('Invalid user id');
        return;
    }

    db.query("SELECT name, profile_color FROM USERS WHERE id = $1", {
        bind: [profileUserId]
    }).spread(function (results) {
        if (results === undefined || results.length !== 1) {
            callback('No user found');
            return;
        }
        var name = results[0].name;
        var firstLetterProfile = user.getFirstLetterForProfile(name);
        var backgroundColor = user.getProfilePictureColor(results[0].profile_color);

        db.query("SELECT CLASSES.id AS id, CLASSES.class_name AS class_name, USERS.name AS instructor FROM ENROLMENT, CLASSES, USERS WHERE USERS.id=CLASSES.instructor AND CLASSES.id=ENROLMENT.class_id AND ENROLMENT.user_id = $1", {
            bind: [profileUserId]

        }).spread(function (classes) {
            user.isGoogleUser(profileUserId, function (err, result) {
                if (err) {
                    callback('Error fetching google information');
                } else {
                    var profileData = {
                        profile_name: firstLetterProfile,
                        background_color: backgroundColor,
                        name: name,
                        classes: classes,
                        isGoogleUser: result
                    };
                    callback('Success', profileData);
                }
            });
        });

    }).catch(function () {
        callback('Database Error');
    });
}

/* Called upon a successful login */
function onSuccessfulLogin(adminId, request, response) {
    
    // Set the associated adminId for this session
    request.session.adminId = adminId;

    // Redirect to Admin Home Page
    common.redirectToPage('/admin', response);
}


/* --- Analytics --- */

/* Handles analytics data requests by providing analytics data about users and classes */
exports.handleAnalyticsDataRequest = function (request, response) {

    analytics.getAnalyticsDataForAdminDashboard(db, function (status, data) {
        if (status == 'Success') {
            // Send JSON response back to the client
            common.sendBackJSON(data, response);
        } else {
            // We shouldn't get here uless something goes terribly wrong
            common.sendInternalServerErrorResponse(response);
        }

    });
};

/* Danger Zone: Services implementing Delete All User and Classes */
exports.handleDeleteAllUsersRequest = function (request, response) {
    deleteAllUsers(function (result) {
        if (result == 'Success') {
            request.session.message = '<p>All users and their associated data have been deleted.</p>';
        } else {
            request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try later!</p>';
        }

        /* Redirect to the admin home page */
        common.redirectToPage('/admin', response);
    });
};

/* Handles delete all classes request by deleting all classes and rendering appropriate message on the front end */
exports.handleDeleteAllClassesRequest = function (request, response) {
    deleteAllClasses(function (result) {
        if (result == 'Success') {
            request.session.message = '<p>All classes and their associated data have been deleted.</p>';
        } else {
            request.session.errorContent = '<p><strong>Opps!</strong> Something went wrong. Please try later!</p>';
        }

        /* Redirect to the admin home page */
        common.redirectToPage('/admin', response);
    });
};

/* Deletes all users from the database and notifies the caller about the
 * result using the `callback` function.
 */
function deleteAllUsers(callback) {
    db.query('DELETE FROM USERS').spread(function () {
        callback('Success');

    }).catch(function () {
        callback('Error');
    });
}


/* Deletes all classes from the database and notifies the caller about the
 * result using the `callback` function.
 */
function deleteAllClasses(callback) {
    db.query('DELETE FROM CLASSES').spread(function () {
        callback('Success');

    }).catch(function () {
        callback('Error');
    });
}