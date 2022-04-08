var express = require("express");

var helper = require("@root/helper_functions");

var Featured = require("@collections/featured");
var Movies = require("@collections/movies");
var Shows = require("@collections/shows");
var Invites = require("@collections/invite_code.js");
var Feedback = require("@collections/feedback.js");
var Requests = require("@collections/requests.js");
var Users = require("@collections/users.js");

var router = express.Router();

router.use("/admin", (req, res, next) => {
    if(req.user.type != "admin"){
        res.redirect("/404");
        return;
    }
    next();
});

router.get("/admin/test", (req, res, next) => {
    res.render("admin/admin_test");
});

router.get("/admin", (req, res, next) => {
    res.render("admin/admin_home_page");
});

router.get("/admin/users", async (req, res, next) => {
    let users = await Users.get_all_users();
    res.render("admin/admin_users_page", {
        users: users,
        helper: helper
    });
});

router.post("/admin/remove_user", async (req, res, next) => {
    let user = req.user;
    let data = req.body;
    
    let id = data["id"];

    if(id == null || id.length == 0){
        res.send({success: false, reason: "No Id Provided"});
        return;
    }
    if(id == String(user._id)){
        res.send({success: false, reason: "You cannot delete your account"});
        return;
    }
    
    // res.send({success: true});

    let result = await Users.delete_user(id);
    res.send(result);
});

router.get("/admin/feedback", async (req, res, next) => {
    let feedbacks = await Feedback.get_all_feedback();
    res.render("admin/admin_feedback_page", {feedbacks: feedbacks, helper: helper});
});

router.get("/admin/invites", async (req, res, next) => {
    let invite_codes = await Invites.get_invite_codes();
    res.render("admin/admin_invites_page", {invite_codes: invite_codes});
});

router.get("/admin/invites/generate", async (req, res) => {
    let user_id = req.user._id;
    let invite_code = await Invites.generate_code(user_id);
    res.send({invite_code: invite_code});
});

router.get("/admin/invites/delete/:id", async (req, res) => {
    let id = req.params.id;

    let result = await Invites.remove_invite_code(id);
    res.send(result);
});

router.get("/admin/featured", (req, res, next) => {
    res.render("admin/admin_featured_page");
});

router.post("/admin/featured/add", async (req, res, next) => {
    let featured_data = req.body;
    
    let id = featured_data["id"];
    let type = featured_data["type"];

    if(id == null || id.length == 0){
        res.send({success: false, reason: "No ID Provided"});
        return;
    }
    if(type == null || type.length == 0){
        res.send({success: false, reason: "No Type Provided"});
        return;
    }
    if(type != "movie" && type != "show"){
        res.send({success: false, reason: "Invalid Type"});
        return;
    }

    let featured_result = await Featured.add_featured(id, type);

    res.send(featured_result);
});

router.post("/admin/featured/remove", async (req, res, next) => {
    let featured_data = req.body;
    
    let id = featured_data["id"];
    let type = featured_data["type"];

    if(id == null || id.length == 0){
        res.send({success: false, reason: "No ID Provided"});
        return;
    }
    if(type == null || type.length == 0){
        res.send({success: false, reason: "No Type Provided"});
        return;
    }
    if(type != "movie" && type != "show"){
        res.send({success: false, reason: "Invalid Type"});
        return;
    }

    let result = await Featured.remove_featured(id, type);
    if(result){
        res.send({success: true});
    }
    else{
        res.send({success: false, reason: "an error occured, featured_remove()"});
    }
});

router.get("/admin/featured/list", async (req, res, next) => {
    let featured = await Featured.get_featured_details();
    res.send(featured);
});

router.get("/admin/uploads", async (req, res, next) => {
    res.render("admin/admin_user_uploads_page");
});

router.get("/admin/requests", async (req, res, next) => {
    let requests = await Requests.get_all_requests();
    res.render("admin/admin_request_page", {requests: requests});
});

router.post("/admin/requests/update_request", async (req, res, next) => {
    let data = req.body;

    let id = data["request_id"];
    let option = data["option"];
    let request = await Requests.get_request(id);
    if(request == null){
        res.send({success: false, reason: "Request doesn't exist"});
        return;
    }

    if(option == "Delete"){
        let result = await Requests.remove_request(id);
        if(result != null){
            result["status"] = "Delete";
            result["request_id"] = id;
        }
        res.send(result);
        return;
    }
    else{
        let result = await request.change_status(option);
        if(result != null){
            result["request_id"] = id;
        }
        res.send(result);
        return;
    }

});


module.exports = router;