var express = require("express");
var fs = require("fs");
var path = require("path");

var config = require("@config");
var Movies = require("@collections/movies.js");
var Shows = require("@collections/shows.js");
var Users = require("@collections/users.js");

var router = express.Router();

router.get("/watch/:type/:id/:season?/:episode?", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();

    let type = req.params.type;
    let id = req.params.id;
    let season = req.params.season;
    let episode = req.params.episode;

    let media_details = null;
    let episode_details = null;
    if(type == "movie"){
        media_details = await Movies.get_movie(id);
    }
    else if(type == "show"){
        media_details = await Shows.get_show(id);
        if(media_details != null){
            if(season == null || episode == null){
                let last_watched = await stats.get_last_watched(id);
                if(last_watched != null){
                    season = last_watched.season;
                    episode = last_watched.episode;
                }
                else{
                    if(season == null){
                        season = 1;
                    }
                    if(episode == null){
                        episode = 1;
                    }
                }
            }
            episode_details = await media_details.get_episode(season, episode);
            if(episode_details == null){
                episode_details = await media_details.get_next_possible_episode(season, episode);
                if(episode_details != null){
                    res.redirect(`/watch/show/${id}/${episode_details.season}/${episode_details.episode}`);
                    return;
                }
                else{
                    res.redirect(`/watch/show/${id}/${1}/${1}`);
                    return;
                }
            }
        }
    }
    else{
        res.redirect("/404");
        return;
    }
    
    if(media_details == null){
        if(type == "show"){
            if(episode_details == null){
                res.redirect("/404");
                return;
            }
        }
        else{
            res.redirect("/404");
            return;
        }
    }

    if(stats){
        await stats.add_recently_watched(media_details.id, media_details.type);
    }

    let backdrop = `/images/${media_details.backdrop}`;
    let subtitles_path = `/subtitles/${type}/${id}`;
    let mp4_url = `/stream/${type}/${id}`;
    if(type == "show"){
        subtitles_path += `/${season}/${episode}`;
        mp4_url += `/${season}/${episode}`;
    }

    res.render("watch_page", {
        username: user.username,
        media_details: media_details,
        episode_details: episode_details,
        mp4_url: mp4_url, 
        backdrop: backdrop,
        subtitles_path: subtitles_path});
});

router.get("/stream/:type/:id/:season?/:episode?", async (req, res, next) => {
    let type = req.params.type;
    let id = req.params.id;
    let season = req.params.season;
    let episode = req.params.episode;


    if(type == "movie"){
        let mp4_path = `${config.movieBuddyFolder}/movies/${id}/${id}.mp4`;
        if(fs.existsSync(mp4_path)){
            res.sendFile(mp4_path);
            return;
        }
        else{
            next();
            return;
        }
    }
    else if(type == "show"){
        let mp4_path = `${config.movieBuddyFolder}/shows/${id}/${season}/${episode}/${id}_${season}_${episode}.mp4`;
        if(fs.existsSync(mp4_path)){
            res.sendFile(mp4_path);
            return;
        }
        else{
            next();
            return;
        }
    }
    
    res.redirect("/404");
});

router.get("/subtitles/file/:filename/:type/:id/:season?/:episode?", async (req, res) => {
    let filename = req.params.filename;
    let type = req.params.type;
    let id = req.params.id;
    let season = req.params.season;
    let episode = req.params.episode;

    let subtitles = "";
    if(type == "movie"){
        subtitles = `${config.movieBuddyFolder}/movies/${id}/subtitles/${filename}`;
    }
    else if(type == "show"){
        subtitles = `${config.movieBuddyFolder}/shows/${id}/${season}/${episode}/subtitles/${filename}`;
    }
    else{
        res.sendStatus(404);
    }

    if(fs.existsSync(subtitles)){
        res.sendFile(subtitles);
    }
    else{
        res.sendStatus(404);
    }
});

router.get("/subtitles/:type/:id/:season?/:episode?", async (req, res) => {    
    let type = req.params.type;
    let id = req.params.id;
    let season = req.params.season;
    let episode = req.params.episode;

    if(type == "movie" || type == "show"){
        let subtitlesFolder = "";
        if(type == "movie"){
            subtitlesFolder = `${config.movieBuddyFolder}/movies/${id}`;
        }
        if(type == "show"){
            subtitlesFolder = `${config.movieBuddyFolder}/shows/${id}/${season}/${episode}`;
        }
        subtitlesFolder += "/subtitles";

        if(fs.existsSync(subtitlesFolder)){
            //traverses the subtitles folder
            let subtitles = fs.readdirSync(subtitlesFolder);
            let allSubtitlesFile = [];

            //iterates through all of the subtitle files in the subtitles folder
            for(let i=0;i<subtitles.length;i++){
                let subsFileName = subtitles[i];//get the subtitle filename
                let fullSubsPath = path.join(subtitlesFolder, subsFileName);//get the absolute path of the subtitle file
                let indexOfExtension = subsFileName.lastIndexOf(".");//get the index of where the extension starts
                let fileNameNoExt = subsFileName.substring(0, indexOfExtension);//get the file name without the extension
                let file_extension = subsFileName.substring(indexOfExtension + 1);//get the file name without the extension
                let fileNameParts = fileNameNoExt.split("_");//splits the filename with _ as the delimiter, this is to get the language name and label

                let label = fileNameParts[fileNameParts.length-2];
                let srclang = fileNameParts[fileNameParts.length-1];

                let subtitlesPath = `/subtitles/file/${subsFileName}/${type}/${id}`;
                if(type == "show"){
                    subtitlesPath += `/${season}/${episode}`;
                }

                allSubtitlesFile.push({
                    fileLocation: subtitlesPath,
                    srclang: srclang,
                    label: label,
                    file_name: subsFileName,
                    file_extension: file_extension
                });
            }
            res.send(allSubtitlesFile);
            return;
        }
    }
    res.redirect("/404");
    
});

//gets the current watch time for a movie/episode
router.get("/getcurrenttime/:type/:id/:season?/:episode?", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();

    let id = req.params.id;
    let type = req.params.type;
    let season = req.params.season;
    let episode = req.params.episode;

    let watchTime = null;
    if(stats){
        watchTime = await stats.get_current_time(id, type, season, episode);
    }
    res.send({watchTime: watchTime});
});

//updates the current time in a movie/episode
router.get("/updatecurrenttime/:time/:type/:id/:season?/:episode?", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();

    let type = req.params.type;
    let id = req.params.id;
    let time = req.params.time;
    let season = req.params.season;
    let episode = req.params.episode;

    if(stats){
        await stats.update_current_time(id, type, season, episode, time);
    }

    res.sendStatus(200);
});

module.exports = router;