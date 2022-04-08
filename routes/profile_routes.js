var express = require("express");
var { DateTime } = require("luxon");

var config = require("@config");
var path = require("path");
var Users = require("@collections/users");

var router = express.Router();


router.get("/profile", async (req, res) => {
    let user = req.user;

    let stats = await user.get_statistics();

    let recently_watched = null;
    let my_list = null;
    let last_online = null;
    let days_watched = null;
    let profile_picture = user.profile_picture != null ? `/profile_image${user.profile_picture}` : "";

    if(stats != null){
        recently_watched = await stats.get_recently_watched();
        my_list = await stats.get_list();
        last_online = await stats.last_online;
        days_watched = await stats.days_watched;
        is_online = await stats.is_online;
    }

    res.render("profile/profile", {
        user: user,
        image_path: "/images",
        recently_watched: recently_watched,
        my_list: my_list,
        last_online: last_online,
        days_watched: days_watched,
        is_online: is_online,
        profile_picture: profile_picture
    });
});

router.get("/profile_image/:image", async (req, res) => {
    let image = req.params.image;
    let profile_picture_path = path.join(config.movieBuddyFolder, "profile_images", image);
    res.sendFile(profile_picture_path);
});

router.get("/profile/updatetimewatched/:deltaTime", async (req, res) => {
    let id = req.user._id;
    let user = await Users.get_details(id);
    let stats = await user.get_statistics();
    let deltaTime = req.params.deltaTime;

    if(deltaTime >= 0){
        let time_watched_seconds = deltaTime / 1000;//convert milliseconds to seconds

        //Gets todays date and rounds it to the nearest 10 minutes
        let todays_date = DateTime.fromJSDate(new Date());
        let todays_date_milli = todays_date.toMillis()
        var minutes_offset = 1000 * 60 * 10;

        let rounded_todays_date_milli = Math.ceil(todays_date_milli / minutes_offset) * minutes_offset;
        //add millis_ to beginning of milliseconds since keys cannot be numbers
        let day_key = `millis_${rounded_todays_date_milli}`;

        let days_watched = stats.days_watched != null ? stats.days_watched : {};

        //checks if the day_key (meaning the 10 minute interval) exists in the days_watched object
        if(!days_watched.hasOwnProperty(day_key)){
            days_watched[day_key] = {
                seconds: time_watched_seconds
            }
        }
        else{//if it does exist, add the time watched to the current time
            let currentTotalTime = days_watched[day_key].seconds;
            let newTotalTime = currentTotalTime + time_watched_seconds;

            days_watched[day_key].seconds = newTotalTime;
        }
        
        //Iterate through all the time watched and remove the ones that are more than 30 days old
        let days_watched_keys = Object.keys(days_watched);
        for(let day of days_watched_keys){
            let day_object = DateTime.fromMillis(parseInt(day.substring(day.indexOf("_")+1)));
            let diff_in_days = todays_date.diff(day_object, "days").values.days;
            if(diff_in_days > 30){
                delete days_watched[day];
            }
        }

        //save
        await stats.updateOne({$set: {days_watched: days_watched}});
    
        res.sendStatus(200)
    }
    else{
        await res.sendStatus(406);
    }
});

router.get("/profile/:username", async (req, res, next) => {
    let username = req.params.username;

    let request_user = await Users.get_user_by_username(username);

    if(request_user == null){
        next();
        return;
    }
    let stats = await request_user.get_statistics();

    let recently_watched = null;
    let my_list = null;
    let last_online = null;
    let days_watched = null;
    let profile_picture = request_user.profile_picture != null ? `/profile_image${request_user.profile_picture}` : "";

    if(stats != null){
        recently_watched = await stats.get_recently_watched();
        my_list = await stats.get_list();
        last_online = await stats.last_online;
        days_watched = await stats.days_watched;
        is_online = await stats.is_online;
    }

    res.render("profile/profile", {
        user: request_user,
        image_path: "/images",
        recently_watched: recently_watched,
        my_list: my_list,
        last_online: last_online,
        days_watched: days_watched,
        is_online: is_online,
        profile_picture: profile_picture
    });
});

// router.post("/profile/send", async (req, res) => {
//     let profile_form = req.body;
//     let user = req.user;

//     let first_name = profile_form["first_name_input"] != null ? profile_form["first_name_input"] : "";
//     let last_name = profile_form["last_name_input"] != null ? profile_form["last_name_input"] : "";
//     let email = profile_form["email_input"] != null ? profile_form["email_input"] : "";

//     let results = await user.change_details(first_name, last_name, email);

//     let map = {
//         "email": "email_input",
//         "first_name": "first_name_input",
//         "last_name": "last_name_input"
//     }

//     for(var key in results) {
//         if(results.hasOwnProperty(key) && key in map) {
//             results[map[key]] = results[key];
//             delete results[key];
//         }
//     }

//     res.send(results);
// });

module.exports = router;