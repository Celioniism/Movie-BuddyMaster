var express = require("express");
var fs = require("fs");
var ejs = require("ejs");

var router = express.Router();

router.get("/mylist", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();
    let my_list = null;
    if(stats != null){
        my_list = await stats.get_list();
    }

    res.render("mylist", {image_path: "/images", my_list: my_list});
});

router.get("/mylist/list", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();
    if(stats){
        let list = await stats.get_list();
        res.send(list);
    }
    else{
        res.send([]);
    }
});

router.post("/mylist/add", async (req, res) => {
    let data = req.body;
    let id = data.id;
    let type = data.type;

    //if this variable is set to true, then use the movie_poster.ejs to render in the html
    let pre_render = (data.pre_render === "true");
    
    if(id == null || type == null){
        res.send({success: false, reason: "Media Id/Type was not provided"});
    }

    let user = req.user;

    let stats = await user.get_statistics();

    if(stats != null){
        let result = await stats.add_to_list(id, type);
        if(result != null && result.success == true && pre_render == true){
            try{
                let media = result.media;
                let file_path = `${__dirname}/../views/snippets/movie_poster.ejs`;
                result.rendered = await ejs.renderFile(file_path, {movie: media, image_path: "/images"});
            } catch(err){
                console.log(err);
            }
        }
        res.send(result);
    }
    else{
        res.send({success: false, reason: "An error has occurred!"});
    }
});

router.post("/mylist/remove", async (req, res) => {
    let data = req.body;
    let id = data.id;
    let type = data.type;
    
    if(id == null || type == null){
        res.send({success: false, reason: "Media Id/Type was not provided"});
    }

    let user = req.user;

    let stats = await user.get_statistics();

    if(stats != null){
        let result = await stats.remove_from_list(id, type);
        res.send(result);
    }
    else{
        res.send({success: false, reason: "An error has occurred!"});
    }
});

module.exports = router;