var express = require("express");
var { DateTime } = require("luxon");

var config = require("@config");

var Users = require("@collections/users");
var Sessions = require("@collections/sessions");
var purify = require("isomorphic-dompurify");
var validator = require("validator");

var FileManager = require("@root/file_manager");
var formidable = require("formidable");
var path = require("path");

var router = express.Router();

const get_all_sessions = async function (req, current_session){
    //converts the store.all() function to a promise
    let read_sessions = (...args) => {
        return new Promise((resolve, reject) => {
            req.store.all(function (err, sessions){
                if (err) return reject(err)
                resolve(sessions);
            });
        })
    }

    let sessions = null;
    try{
        sessions = await read_sessions();
    } catch(err){

    }
    let user_sessions = [];
    
    if(sessions != null){
        //filter the sessions to only have the current users sessions
        let filteredSessions = sessions.filter(function (session) {//find all sessions that this user has
            if(session.passport){//if the session is connected to a user
                if(session.passport.user == current_session.passport.user){
                    return true;
                }
            }
            return false;
        });

        //iterate through all of the filter sessions and add extra details
        for(let i=0;i<filteredSessions.length;i++){//extract user_session_details from the user sessions object
            let details = filteredSessions[i].user_session_details;
            if(details){//checks if user_session_details exist
                if(details.last_online){//add how long ago this session was last online
                    let last_online = DateTime.fromJSDate(new Date(details.last_online));
                    details.time_ago = last_online.toRelative();
                }
                if(current_session.user_session_details.device_session_id == details.device_session_id){//checks if the session currently being iterated is this session
                    details.this_device = true;
                    user_sessions.unshift(filteredSessions[i].user_session_details);
                }
                else{
                    user_sessions.push(filteredSessions[i].user_session_details);
                }
            }
        }
    }
    return user_sessions;
}

router.get("/settings", async (req, res) => {
    let user = req.user;

    let current_session = req.session;
    let user_sessions = await get_all_sessions(req, current_session);

    res.render("profile/settings", {
        user: user,
        sessions: user_sessions
    });
});

router.post("/settings/change_profile_pic/send", async (req, res, next) => {
    let user = req.user;
    let profile_images_folder = path.join(config.movieBuddyFolder, "profile_images");

    /**
     * This makes sure that the profile_images folder exists before adding files to it
     * NOTE: probably should put in file directory
     */
    FileManager.ensure_directory_existence(profile_images_folder);

    //Set up formidable
    const form = formidable({
        multiples: true,
        uploadDir: profile_images_folder,//ensure that the directory exists before uploading
        keepExtensions: true,
        maxFileSize: 1024 * 1024 * 25//max upload size 25 mbs
    });

    //This adds the users upload to the database
    let results = {};

    //Checks if the file has the right extension, if not then do not upload to file system
    form.onPart = function (part) {
        if(!part.filename.match(/\.(png|jpg|jpeg)$/)){
            results[part.filename] = {success: false, reason: "Unsupported file type."}
            res.send(results);
            return;
        }
        else{
            form.handlePart(part);
        }
    }

    //If the file has passed the extension check, then continue processing the file
    form.parse(req, async (err, fields, files) => {
        if (err) {
            if(err.message.startsWith("maxFileSize")){
                results["Error"] = {success: false, reason: "File is too large, File size cannot exceed 25 Mbs"};
            }
            else{
                results["Error"] = {success: false, reason: err.message};
            }
            res.send(results);
            return;
        }
        else{
            let file = files.profile_pic;
            if(file){
                let file_name = path.basename(file.path);
                if(user.profile_picture != null){
                    let old_profile_picture = path.join(profile_images_folder, user.profile_picture);
                    let result = FileManager.delete_file(old_profile_picture);
                }
                await user.change_profile_picture(`/${file_name}`);
                results["new_profile_pic"] = {success: true, profile_picture: `/${file_name}`}
            }
            res.send(results);
        }
    });
    
});

router.post("/settings/change_email/send", async (req, res) => {
    let form = req.body;
    let user = req.user;

    let email = form["email_input"] != null ? purify.sanitize(form["email_input"]).trim() : "";

    let results = await user.change_details({email: email});

    if(results.hasOwnProperty("email")){
        results["email_input"] = results["email"];
        delete results["email"];
    }

    res.send(results);
});

router.post("/settings/change_username/send", async (req, res) => {
    let form = req.body;
    let user = req.user;

    let username = form["username_input"] != null ? purify.sanitize(form["username_input"]).trim() : "";

    let results = await user.change_details({username: username});

    if(results.hasOwnProperty("username")){
        results["username_input"] = results["username"];
        delete results["username"];
    }

    res.send(results);
});

router.post("/settings/change_name/send", async (req, res) => {
    let form = req.body;
    let user = req.user;

    let first_name = form["first_name_input"] != null ? purify.sanitize(form["first_name_input"]).trim() : "";
    let last_name = form["last_name_input"] != null ? purify.sanitize(form["last_name_input"]).trim() : "";

    let results = await user.change_details({first_name: first_name, last_name: last_name});

    if(results.hasOwnProperty("first_name")){
        results["first_name_input"] = results["first_name"];
        delete results["first_name"];
    }
    if(results.hasOwnProperty("last_name")){
        results["last_name_input"] = results["last_name"];
        delete results["last_name"];
    }

    res.send(results);
});

router.post("/settings/change_password/send", async (req, res) => {
    let form = req.body;
    let user = req.user;

    let current_password = form["current_password_input"] != null ? form["current_password_input"] : "";
    let new_password = form["new_password_input"] != null ? form["new_password_input"] : "";
    let confirm_new_password = form["confirm_new_password_input"] != null ? form["confirm_new_password_input"] : "";
    
    let options = {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 0,
        returnScore: false
    }

    let results = {};
    let should_change = true;

    if(!(await user.verify_password(current_password))){
        results["current_password_input"] = { success: false, reason: "You entered an incorrect password" };

        should_change = false;
    }
    if (new_password != confirm_new_password) {
        results["new_password_input"] = { success: false, reason: "Passwords do not match" };
        results["confirm_new_password_input"] = { success: false, reason: "Passwords do not match" };

        should_change = false;
    }
    else if (!validator.isStrongPassword(new_password, options)) {
        results["new_password_input"] = { success: false, reason: "The password you entered is not strong enough" };

        should_change = false;
    }
    else {
        results["new_password_input"] = { success: true, reason: "Password was successfully changed"};
        results["confirm_new_password_input"] = { success: true, reason: "Password was successfully changed" };
    }

    if(should_change){
        let result = await user.change_password(current_password, new_password);
        results["success"] = result;
    }

    res.send(results);
});

router.post("/settings/clear", async (req, res) => {
    let user = req.user;
    let form = req.body;
    let type_to_clear = form.type;//type can either be watch_history or time_watched
    if(type_to_clear == "watch_history"){
        let stats = await user.get_statistics();
        if(stats){
            await stats.clear_recently_watched();
        }
    }
    else if(type_to_clear == "time_watched"){
        let stats = await user.get_statistics();
        if(stats){
            await stats.clear_days_watched();
        }
    }
    res.status(200);
});

router.get("/settings/sessions", async (req, res) => {
    let current_session = req.session;
    let user_sessions = await get_all_sessions(req, current_session);
    res.render("profile/sessions", {sessions: user_sessions});
});

router.get("/settings/sessions/list", async (req, res) => {
    let current_session = req.session;
    let user_sessions = await get_all_sessions(req, current_session);
    res.send(user_sessions);
});

router.get("/settings/sessions/logout/:device_session_id", async (req, res) => {
    let current_session = req.session;
    let session_id = req.params.device_session_id;

    let allSessions = await Sessions.get_all();

    var filteredSessions = allSessions.filter(function (session) {//filters out all of the sessions that belong to this user
        let jsonSession = JSON.parse(session.session);
        if(jsonSession.passport != null && current_session.passport != null){//check if both sessions have a passport object
            if(jsonSession.passport.user == current_session.passport.user){//check if the current user matches the session user
                return true;
            }
        }
        return false;
    });

    let sessionToDestroy = undefined;
    for(let i=0;i<filteredSessions.length;i++){//iterate through all of the current users sessions and find the session requested
        let jsonSession = JSON.parse(filteredSessions[i].session);
        if(jsonSession.user_session_details && jsonSession.user_session_details.device_session_id == session_id){
            sessionToDestroy = filteredSessions[i];
            break;
        }
    }
    if(sessionToDestroy){
        let sid = sessionToDestroy._id;
        req.store.destroy(sid, (err) => {});
    }
    res.redirect("/settings/sessions");
});

module.exports = router;