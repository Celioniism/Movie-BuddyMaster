var express = require("express");

var Requests = require("@collections/requests.js");
var helper = require("@root/helper_functions.js");
var purify = require('isomorphic-dompurify');

var router = express.Router();

router.get("/requests", async (req, res) => {
    let user = req.user;
    let requests = await Requests.get_all_requests_by_user(user._id);
    res.render("requests", {requests: requests});
});

router.post("/requests/delete/:requests_id", async (req, res) => {
    let requests_id = req.params.requests_id;
    let user = req.user;
    let request = await Requests.belongs_to(user._id, requests_id);

    let result = {};

    if(request.success == true){
        result["success"] = await Requests.remove_request(requests_id);
    }
    else{
        result["success"] = {success: false, reason: request.reason};
    }

    res.send(result);
});

router.post("/requests/send", async (req, res) => {
    let feedback_form = req.body;
    let user = req.user;

    let media_name = feedback_form["movie_name"] != null ? purify.sanitize(feedback_form["movie_name"]) : "";
    let imdb_link = feedback_form["imdb_link"] != null ? purify.sanitize(feedback_form["imdb_link"]) : "";

    let results = {};
    let canAdd  = true;

    if(media_name.length == 0){
        results["movie_name"] = {success: false, reason: "Media field cannot be empty"};
        canAdd = false;
    }
    else{
        results["movie_name"] = {success: true}
    }

    if(imdb_link.length == 0){
        results["imdb_link"] = {success: false, reason: "IMDB Link field cannot be empty"};
        canAdd = false;
    }
    else{
        results["imdb_link"] = {success: true}
    }

    if(canAdd){
        let request = await Requests.add_request(user._id, media_name, imdb_link);
        if(request.success == true){
            results["success"] = {success: true, request: request, redirect: "/requests"};
        }
        else{
            results["success"] = {success: false, reason: request.reason};
        }
    }

    res.send(results);
});

module.exports = router;