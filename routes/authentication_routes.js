var config = require("@config");
var express = require("express");
var validator = require("validator");
var passport = require('passport');
var purify = require('isomorphic-dompurify');

var User = require("@collections/users");
var Sessions = require("@collections/sessions");
var randomstring = require('randomstring');

var router = express.Router();

/*
Sets all session information

*/
async function preLogin(req){
    if(!req.session.user_session_details){//sets the current session date for a specific user
        req.session.user_session_details = {};
    }
    req.session.user_session_details.device_session_id = randomstring.generate({
        length: 128,
    });
    req.session.user_session_details.device_type = req.device.type;
    req.session.user_session_details.device_name = req.device.name;
    req.session.user_session_details.device_os = req.device.parser.useragent.os.family;
    
    let info = req.ipInfo;
    let ip = info.ip.split(",");
    let city = info.city ? info.city : "";
    let region = info.region ? info.region : "";
    let location = `${city} ${region}`;
    req.session.user_session_details.ip = ip[0];
    req.session.user_session_details.location = location;

    req.session.user_session_details.first_time_sign_in = Date.now();
}

//Logout
router.get('/logout', (req, res) => {
    req.session.destroy(function (err) {
        if (req.cookies != null) {
            res.clearCookie('connect.sid');
        }
        res.redirect('/');
    });
});

router.get("/login", (req, res) => {
    res.render("login");
});

router.post("/login/send", (req, res, next) => {
    let login_form = req.body;
    let email = login_form["email_input"] != null ? purify.sanitize(login_form["email_input"]) : "";
    let password = login_form["password_input"] != null ? purify.sanitize(login_form["password_input"]) : "";

    let results = {};
    let proceed_login = true;

    if (validator.isEmpty(email)) {
        results["email_input"] = { success: false, reason: "The email field cannot be empty" };
        proceed_login = false;
    }
    if (validator.isEmpty(password)) {
        results["password_input"] = { success: false, reason: "The password field cannot be empty" };
        proceed_login = false;
    }

    if (proceed_login == true) {
        passport.authenticate('local', function (err, user, info) {
            if (err) {
                return next(err); // will generate a 500 error
            }
            if (!user) {
                if (info["key"] == "email") {
                    results["email_input"] = info;
                }
                else if (info["key"] == "password") {
                    results["password_input"] = info;
                }
                return res.send(results);
            }
            req.login(user, async loginErr => {
                if (loginErr) {
                    return next(loginErr);
                }

                results["success"] = info;
                await preLogin(req);
                return res.send(results);
            });
        })(req, res, next);
    }
    else {
        res.send(results);
    }
});

router.get("/register", (req, res) => {
    res.render("register");
});

router.post("/register/send", async (req, res) => {
    let register_form = req.body;

    //this chunk of code ensures that the inputs are not null
    let username = register_form["username_input"] != null ? purify.sanitize(register_form["username_input"]) : "";
    let email = register_form["email_input"] != null ? purify.sanitize(register_form["email_input"]) : "";
    let first_name = register_form["first_name_input"] != null ? purify.sanitize(register_form["first_name_input"]) : "";
    let last_name = register_form["last_name_input"] != null ? purify.sanitize(register_form["last_name_input"]) : "";
    let password = register_form["password_input"] != null ? purify.sanitize(register_form["password_input"]) : "";
    let confirm_password = register_form["password_confirm_input"] != null ? purify.sanitize(register_form["password_confirm_input"]) : "";
    let invite_code = register_form["invite_code_input"] != null ? purify.sanitize(register_form["invite_code_input"]) : "";

    email = validator.normalizeEmail(email);
    first_name = first_name.trim();
    last_name = last_name.trim();
    password = password;
    confirm_password = confirm_password;
    invite_code = invite_code.trim();

    //The options that define a strong password
    let options = {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 0,
        returnScore: false
    }

    //The results of each field
    let results = {};

    //Checks if the user already exists
    let user_exists = await User.does_email_exist(email);
    let username_exists = await User.does_username_exist(username);
    let proceed_creation = true;

    //Email Validation
    if (user_exists) {
        results["email_input"] = { success: false, reason: "A user with that email already exists" };
        proceed_creation = false;
    }
    else if (!validator.isEmail(email)) {
        results["email_input"] = { success: false, reason: "The email you entered is invalid" };
        proceed_creation = false;
    }
    else {
        results["email_input"] = { success: true };
    }

    //Username Validation
    if(validator.isEmpty(username)){
        results["username_input"] = { success: false, reason: `A username must be provided` };
        proceed_creation = false;
    }
    else if (username_exists) {
        results["username_input"] = { success: false, reason: `${username} is already taken` };
        proceed_creation = false;
    }
    else {
        results["username_input"] = { success: true };
    }

    //First Name Validation
    if (validator.isEmpty(first_name)) {
        results["first_name_input"] = { success: false, reason: "The first name field cannot be empty" };
        proceed_creation = false;
    }
    else {
        results["first_name_input"] = { success: true };
    }

    //Last Name Validation
    if (validator.isEmpty(last_name)) {
        results["last_name_input"] = { success: false, reason: "The last name field cannot be empty" };
        proceed_creation = false;
    }
    else {
        results["last_name_input"] = { success: true };
    }

    //Password Validation
    if (password != confirm_password) {
        results["password_input"] = { success: false, reason: "Passwords do not match" };
        results["password_confirm_input"] = { success: false, reason: "Passwords do not match" };

        proceed_creation = false;
    }
    else if (!validator.isStrongPassword(password, options)) {
        results["password_input"] = { success: false, reason: "The password you entered is not strong enough" };

        proceed_creation = false;
    }
    else {
        results["password_input"] = { success: true };
        results["password_confirm_input"] = { success: true };
    }

    //Attempt to create account
    if (proceed_creation == true) {
        let user_existence = await User.does_email_exist(email);
        if (user_existence) {//the user exists
            results["email_input"] = { success: false, reason: "" }
        }
        else {
            let create_result = await User.create_user(email, username, first_name, last_name, password, invite_code);
            if (create_result["success"] == true) {//registration has been completed
                let user = create_result["user"];
                const login = (user) => {
                    return new Promise((resolve, reject) => {
                        req.login(user, async function (err) {
                            if (err) return reject(err)
                            resolve();
                        })
                    })
                }

                try {
                    await login(user);
                    await preLogin(req);
                    results["success"] = { success: true, redirect: "/" };
                } catch(err){
                    console.log(err);
                }
            }
            else {//registration failed
                //error messages not going to correct field
                results["invite_code_input"] = { success: false, reason: create_result["reason"] };
            }
        }
    }
    res.send(results);
});

module.exports = router;