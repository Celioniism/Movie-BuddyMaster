var express = require("express");

var Feedback = require("@collections/feedback.js");
var helper = require("@root/helper_functions.js");

var purify = require('isomorphic-dompurify');

var router = express.Router();

router.get("/feedback", async (req, res) => {
    let user = req.user;
    let feedbacks = await Feedback.get_all_feedback_by_user(user._id);
    res.render("feedback", {feedbacks: feedbacks, helper: helper});
});

router.post("/feedback/delete/:feedback_id", async (req, res) => {
    let feedback_id = req.params.feedback_id;
    let user = req.user;
    let feedback = await Feedback.belongs_to(user._id, feedback_id);

    let result = {};

    if(feedback.success == true){
        result["success"] = await Feedback.remove_feedback(user._id, feedback_id);
    }
    else{
        result["success"] = {success: false, reason: feedback.reason};
    }

    res.send(result);
});

router.post("/feedback/send", async (req, res) => {
    let feedback_form = req.body;
    let user = req.user;

    let subject = feedback_form["subject_input"] != null ? purify.sanitize(feedback_form["subject_input"]) : "";
    let description = feedback_form["description_input"] != null ? purify.sanitize(feedback_form["description_input"]) : "";

    let results = {};
    let canAdd  = true;

    if(subject.length == 0){
        results["subject_input"] = {success: false, reason: "Subject field cannot be empty"};
        canAdd = false;
    }
    else{
        results["subject_input"] = {success: true}
    }

    if(description.length == 0){
        results["description_input"] = {success: false, reason: "Description field cannot be empty"};
        canAdd = false;
    }
    else{
        results["description_input"] = {success: true}
    }

    if(canAdd){
        let feedback = await Feedback.add_feedback(user._id, subject, description);
        results["success"] = {success: true, feedback: feedback, redirect: "/feedback"};
    }

    res.send(results);
});

module.exports = router;