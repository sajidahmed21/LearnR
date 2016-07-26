/*app.get('/check', function (req, res) {
    db.query('SELECT * FROM USERS').spread(function (results, metadata) {
        console.log(results);
        res.render('demo', {
            userCount: results[0].userCount,
            leggedIn: false,
            demo: true
        });

    });
});
app.get('/checkk', function (req, res) {
    db.query('SELECT * FROM FOLLOWINGS').spread(function (results, metadata) {
        console.log(results);
        res.render('demo', {
            //userCount: results[0].userCount,
            leggedIn: false,
            demo: true
        });

    });
});

app.get('/enrolls', function (req, res) {
    db.query("INSERT INTO ENROLMENT (user_id, class_id) VALUES (5, 1)").spread(function (results, metadata) {
        console.log("JOIN 1");
    });
    db.query("INSERT INTO ENROLMENT (user_id, class_id) VALUES (5, 2)").spread(function (results, metadata) {
        console.log("JOIN 2");
    });
});
app.get('/enroll', function (req, res) {
    db.query("INSERT INTO CLASSES (id, class_name, instructor) VALUES (1, 'TESTCOURSE', 3)").spread(function (results, metadata) {
        db.query("INSERT INTO ENROLMENT (user_id, class_id) VALUES (18, 1)").spread(function (results, metadata) {
            console.log("JOIN 1");
        })
    });
    db.query("INSERT INTO CLASSES (id, class_name, instructor) VALUES (2, 'TESTCOURSE2', 3)").spread(function (results, metadata) {
        db.query("INSERT INTO ENROLMENT (user_id, class_id) VALUES (18, 2)").spread(function (results, metadata) {
            console.log("JOIN 2");
        })
    });
});*/
var common = require('./common');
var bcrypt = require('bcryptjs');
var sendBackJSON = common.sendBackJSON;
var sendUnauthorizedResponse = common.sendUnauthorizedResponse;
var setLoggedInUserId = common.setLoggedInUserId;
var getLoggedInUserId = common.getLoggedInUserId;
var db = common.db;
var color = ['green_background', 'light_green_background', 'blue_background', 'yellow_background', 'orange_background', 'red_background'];

exports.color = color;

//function for change user name
exports.changeNameHandler = function (req, res) {
    var changeName = req.body.changeName;
    var user_id = getLoggedInUserId(req);
    db.query("UPDATE USERS SET name = $1 WHERE id= $2", {
        bind: [changeName, user_id]
    }).spread(function (results, metadata) {
        var returnJSON = {
            "status": "success",
            "message": "Change Name Success"
        }
        sendBackJSON(returnJSON, res);
    }).catch(function (err) {
        console.log("Err in change name");
        var returnJSON = {
            "status": "error",
            "message": "Err in change name"
        }
        sendBackJSON(returnJSON, res);
    });
};

//function for change profile picture
exports.changeProfilePicHandler = function (req, res) {
    var changeProfilepic = req.body.changeProfilepic;
    var user_id = getLoggedInUserId(req);
    db.query("UPDATE USERS SET profile_picture_path = '" + changeProfilepic + "' WHERE id=" + user_id).spread(function (results, metadata) {
        var returnJSON = {
            "status": "success",
            "message": "Change Profile Pic Success"
        }
        sendBackJSON(returnJSON, res);
    }).catch(function (err) {
        console.log("Err in change profile pic");
        var returnJSON = {
            "status": "error",
            "message": "Err in change profile pic"
        }
        sendBackJSON(returnJSON, res);
    });
};

//function for change password
exports.changePasswordHandler = function (req, res) {
    bcrypt.hash(req.body.changePassword, 8, function (err, hashedPassword) {
        if (err) {
            console.log('failed to hash password:');
            console.log(err);

            sendBackJSON({
                "error": "server error"
            }, res);
            return;
        }

        var user_id = getLoggedInUserId(req);
        db.query("UPDATE LOGIN_CREDENTIALS SET password = $1 WHERE user_id= $2", {
            bind: [hashedPassword, user_id]
        }).spread(function (results, metadata) {
            var returnJSON = {
                "status": "success",
                "message": "Change Password Success"
            }
            sendBackJSON(returnJSON, res);
        }).catch(function (err) {
            console.log("Err in change password");
            var returnJSON = {
                "status": "error",
                "message": "Err in change password"
            }
            sendBackJSON(returnJSON, res);
        });
    });
};

//function for unenroll class
exports.unenrollHandler = function (req, res) {
    var user_id = getLoggedInUserId(req);
    var class_id = req.body.dropCourse_id;
    db.query("DELETE FROM ENROLMENT WHERE user_id= $1 AND class_id = $2",{
        bind: [user_id, class_id]
    }).spread(function (results, metadata) {
        var returnJSON = {
            "status": "success",
            "message": "Delete Success"
        }
        sendBackJSON(returnJSON, res);
    }).catch(function (err) {
        console.log("Err in delete course");
        var returnJSON = {
            "status": "error",
            "message": "Err in delete course"
        }
        sendBackJSON(returnJSON, res);
    });
};

/* Renders the profile for the user with the userId equal to profileUserId. */
exports.getProfileHandler = function (req, res, profileUserId) {
    console.log("GETPROFILE" + profileUserId);
    console.log(common.getLoggedInUserId(req));
    db.query("SELECT name, profile_picture_path FROM USERS WHERE id = $1",{
        bind: [profileUserId]
    }).spread(function (results, metadata) {
        var name = results[0].name;
        var background_color = results[0].profile_picture_path;
        if (color.indexOf(background_color) < 0)
            background_color = 'grey_background';
        var firstLetterProfile = name.charAt(0);
        if (firstLetterProfile >= 'a' && firstLetterProfile <= 'z')
            firstLetterProfile = firstLetterProfile.toUpperCase();
        console.log('HERREEEEEE');
        db.query("SELECT CLASSES.id AS id, CLASSES.class_name AS class_name, USERS.name AS instructor FROM ENROLMENT, CLASSES, USERS WHERE USERS.id=CLASSES.instructor AND CLASSES.id=ENROLMENT.class_id AND ENROLMENT.user_id = $1",{
            bind: [profileUserId]
        }).spread(function (result, meta) {
            db.query("SELECT EXISTS(SELECT 1 FROM FOLLOWINGS WHERE follower = $1 AND followee= $2 ) AS checkfollow",{
                bind:[getLoggedInUserId(req), profileUserId]
            }).spread(function (resultInner, metaInner) {
                var boolFollow = false;
                if (resultInner[0]['checkfollow'] == 1)
                    boolFollow = true;
                console.log(result);
                res.render('profile', {
                    profile_name: firstLetterProfile,
                    background_color: background_color,
                    name: name,
                    classes: result,
                    loggedIn: common.userIsLoggedIn(req),
                    current_id: profileUserId,
                    followed: boolFollow,
                    userIsOwner: profileUserId == getLoggedInUserId(req)
                });
            })
        })

    }).catch(function (err) {
        console.log("Err in getting user profile");
        var returnJSON = {
            "status": "error",
            "message": "Err in getting user profile"
        }
        sendBackJSON(returnJSON, res);
    });
};

//function for login 
exports.signinHandler = function (req, res) {
    var signinUsername = req.body.signinUsername;
    var signinPassword = req.body.signinPassword;
    db.query("SELECT user_id, password FROM LOGIN_CREDENTIALS WHERE username = $1",{
        bind: [signinUsername]
    }).spread(function (results, metadata) {
        var thisid = results[0].user_id;
        console.log(thisid);
        bcrypt.compare(signinPassword, results[0].password, function (err, result) {
            if (err || result === false) {
                console.log("Err in login");
                res.status(401);
                return res.render('home', {
                    errorContent: '<p><strong>Opps!</strong> Your username and password do not match!</p>',
                    loggedIn: false
                });
            } else {
                console.log("signinHandler " + results[0].user_id);
                setLoggedInUserId(req, results[0].user_id);
                exports.getProfileHandler(req, res, results[0].user_id);

                //                var returnJSON = {
                //                    "status": "success",
                //                    "message": "Login Success"
                //                }
                //                sendBackJSON(returnJSON, res);
            }
        })
    }).catch(function (err) {
        res.status(401);
        return res.render('home', {
            errorContent: '<p><strong>Opps!</strong> Your username and password do not match!</p>',
            loggedIn: false
        });
    });
};

/* Handles sign up requests for new users by creating a new user account and then
 * rendering the profile page for the newly created user.
 */
exports.signupHandler = function (request, response) {
    var name = request.body.signupName;
    var username = request.body.signupUsername;
    var password = request.body.signupPassword;
    var passwordConfirmation = request.body.userPasswordConfirm;
    
    exports.createUser(name, username, password, passwordConfirmation, function (errorType, userId) {
        
        console.log(errorType);
        if (errorType === undefined) { // Success
            // Automatically log the user in
            setLoggedInUserId(request, userId);
            exports.getProfileHandler(request, response, userId);
            return;
        }
        
        // Check error type and render web page with the appropriate message for the end user
        switch (errorType) {
            case 'Incorrect Password Length':
                response.status(401);
                return response.render('home', {
                    errorContent: '<p><strong>Opps!</strong> Your password must be at least 8 characters long!</p>',
                    loggedIn: false
                });
            case 'Passwords Don\'t Match':
                response.status(401);
                return response.render('home', {
                    errorContent: '<p><strong>Opps!</strong> Your password do not match!</p>',
                    loggedIn: false
                });
            case 'Username Already Taken':
                response.status(401);
                return response.render('home', {
                    errorContent: '<p><strong>Opps!</strong> The username has been taken! Please choose another username!</p>',
                    loggedIn: false
                });
        }
    });
};

/* Validates the name, username, password, passworedConfirmation and then creates
 * a new user account. Success / failure of the account creation is notified via
 * the provided callback.
 */
exports.createUser = function (name, username, password, passwordConfirmation, callback) {
    
    if (password != passwordConfirmation) {
        callback('Passwords Don\'t Match');
        return;
    }
    
    if (password.length < 8) {
        callback('Incorrect Password Length');
        return;
    }
    
    var hashedPassword = common.generatePasswordHash(password);
    
    // Randomly select a profile picture color for newly joined user
    var signupProfilePicture = color[Math.floor(Math.random() * 5)];

    db.transaction(function (transactionObject) {
        // Insert into USERS table
        return db.query("INSERT INTO USERS (name, profile_picture_path) VALUES ( $1 , $2 )", {
            transaction: transactionObject,
            bind: [name, signupProfilePicture]
        })
        .then(function (result) {
            var metadata = result[1];
            
            // Insert into LOGIN_CREDENTIALS table
            return db.query("INSERT INTO LOGIN_CREDENTIALS (user_id, username, password) VALUES ( $1 , $2 , $3 )", {
                transaction: transactionObject,
                bind: [metadata.lastID, username, hashedPassword]
            });
        });
    }).then(function (results) {
        // Transaction has been successfully committed
        var metadata = results[1];
        
        // Notify about succesful user creation to the caller
        callback(undefined, metadata.lastID);
        
    }).catch(function () {
        // Transaction has been rolled back
        // Notify caller about duplicate user name
        callback('Username Already Taken');
    });
};


//function for logout 
exports.logoutHandler = function (req, res) {
    // if a user is logged in, logout and return
    if (getLoggedInUserId(req) != 0) {
        setLoggedInUserId(req, 0);
        console.log("INLOGGINOUT");
        var returnJSON = {
            "status": "success",
            "message": "Logout Success"
        }
        sendBackJSON(returnJSON, res);
    }
    // otherwise return an error
    else {
        setLoggedInUserId(req, 0);
        var returnJSON = {
            "status": "error",
            "message": "Logout Error"
        }
        sendBackJSON(returnJSON, res);
    }
};

//CASCADE ALL USERS and CLASSES
exports.deleteUserHandler = function (req, res) {
    var user_id = getLoggedInUserId(req);
    // always set the user_id to logged out
    setLoggedInUserId(req, 0);

    db.query("DELETE FROM LOGIN_CREDENTIALS WHERE user_id=" + user_id).spread(function (results, metadata) {
        db.query("DELETE FROM USERS WHERE id=" + user_id).spread(function (results, metadata) {
            var returnJSON = {
                "status": "success",
                "message": "Delete Success"
            }
            sendBackJSON(returnJSON, res);
        }).catch(function (err) {
            console.log("Err in deleting user");
            var returnJSON = {
                "status": "error",
                "message": "Err in delete inner"
            }
            sendBackJSON(returnJSON, res);
        });
    }).catch(function (err) {
        console.log("Err in delete course");
        var returnJSON = {
            "status": "error",
            "message": "Err in delete user outer"
        }
        sendBackJSON(returnJSON, res);
    });
};