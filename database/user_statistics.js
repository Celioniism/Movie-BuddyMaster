const Mongoose = require("mongoose");
const config = require("@config");
const { DateTime, Interval } = require("luxon");

const Movies = require("@collections/movies");
const Shows = require("@collections/shows");

const helper = require("@root/helper_functions");

let user_statistics = new Mongoose.Schema({
    user_id: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    recently_watched: {
        type: Array,
        default: []
    },
    list: {
        type: Array,
        default: []
    },
    last_online: {
        type: Date
    },
    days_watched: {
        type: Object
    },
    is_online: {
        type: Date,
        get: is_online
    }
}, {
    collections: config.collections.user_statistics
});

/* Online means that they have been active for the past 5 minutes */
function is_online(value){
    let last_online = this.last_online;
    if(last_online != null){
        let today_date = DateTime.now();
        let interval = Interval.fromDateTimes(last_online, today_date);
        if(interval.length("minutes") < 5){
            return true;
        }
    }
    return false;
}

user_statistics.statics.create_statistics = async function(user_id) {
    let stats = await this.findOne({user_id: user_id}).exec();
    if(stats != null){
        return null;
    }
    stats = new this({user_id: user_id});
    
    try{
        await stats.save();
        return stats;
    } catch(err){
        console.log(err);
        return null;
    }
}

/**
 * Removes a users statistics based on the user id
 * @param {ObjectId} user_id the user id
 */
user_statistics.statics.remove_statistics_by_user = async function(user_id){
    try{
        await this.deleteOne({user_id: user_id});
        return {success: true};
    } catch(err){
        console.log(err);
        return {success: false, reason: `error code ${err.code}`};
    }
}

/**
 * Gets a users statistics based on the user_statistics id
 * Note: does not check if user exists
 * @param {ObjectId} id The user_statistics id
 * @returns the statistics of a user, otherwise returns null
 */
user_statistics.statics.get_statistics = async function(id) {
    try{
        let stats = await this.findById(id).exec();
        return stats;
    } catch(err){
        console.log(err);
        return null;
    }
}

/**
 * Gets a specific users statistics, if the user doesn't have an statistics then it will create one
 * Note: does not check if user exists
 * @param {ObjectId} user_id The users id
 * @returns the statistics of the user, otherwise returns null
 */
user_statistics.statics.get_statistics_by_user = async function(user_id) {
    let stats = await this.findOne({user_id: user_id}).exec();
    return stats;
}

/**
 * Retrieves a detail list of all of the media that the user has stored in their list
 * @returns An array of media objects, either movie/shows; refer to database/movies.js and database/shows.js
 */
user_statistics.methods.get_list = async function(){
    let list = [];
    for(let list_media of this.list){
        let id = list_media.id;
        let type = list_media.type;
        
        if(type == "movie"){
            let movie = await Movies.get_movie(id);
            if(movie != null){
                list.push(movie);
            }
        }
        else if(type == "show"){
            let show = await Shows.get_show(id);
            if(show != null){
                list.push(show);
            }
        }
    }

    return list;
}

/**
 * Checks to see if a specific movie or show is in the users list
 * @param {Number} id The id of the movie/show
 * @param {String} type the media type. movie/show
 * @returns true if the media exists, false if it doesn't
 */
user_statistics.methods.in_list = async function(id, type){
    for(let i=0;i<this.list.length;i++){
        let media = this.list[i];
        if(media.id == id && media.type == type){
            return true;
        }
    }
    return false;
}

/**
 * Adds a specific movie or show to the users list
 * @param {Number} id The id of the movie/show
 * @param {String} type The media type. movie/show
 * @returns true if the addition of the media was successful, else returns false
 */
user_statistics.methods.add_to_list = async function(id, type){
    //this exists variable is used to check if the movie/show is in the users list
    let exists = false;

    for(let i=0;i<this.list.length;i++){
        let media = this.list[i];
        if(media.id == id && media.type == type){
            exists = true;
            break;
        }
    }
    let media = null;

    if(!exists){
        //this checks if the type is a valid type such as movie or show
        if(type == "movie"){
            media = await Movies.get_movie(id);
            if(media == null){
                return {success: false, reason: "This movie does not exist"};
            }
        }
        else if(type == "show"){
            media = await Shows.get_show(id);
            if(media == null){
                return {success: false, reason: "This movie does not exist"};
            }
        }
        else{
            return {success: false, reason: "Invalid type"};
        }

        
        this.list.push({id: id, type: type});

        try{
            await this.save();
            if(!exists){
                return {success: true, media: media};
            }
        } catch(err){
            return {success: false, reason: err.message};
        }
    }
    return {success: false, reason: "The media already exists"};
}

/**
 * Removes a specific movie or show from the users list
 * @param {Number} id The id of the movie/show
 * @param {String} type The media type. movie/show
 * @returns  true is the removal of the media was success, else false
 */
user_statistics.methods.remove_from_list = async function(id, type){
    let removed = false;

    for(let i=0;i<this.list.length;i++){
        let media = this.list[i];
        if(media.id == id && media.type == type){
            this.list.splice(i, 1);
            removed = true;
            break;
        }
    }

    try{
        await this.save();
        if(removed){
            return {success: true};
        }
        else{
            return {success: false, reason: "The media does not exist"};
        }
    } catch(err){
        return {success: false, reason: err.message};
    }
}

/**
 * Gets the last season and episode watched from a show
 * @param {Number} id The show id 
 * @returns a simple object containing the season and episode
 */
user_statistics.methods.get_last_watched = async function(id){
    if(helper.isInt(id)){
        let media = this.recently_watched.find(element => element.type == "show" && element.id == id);
        if(media != null){
            let last_watched = media.last_watched;
            return last_watched;
        }
    }
    return null;
}

/**
 * Gets all of the users recently watched
 * @returns An array of media object. either movie/show; refer to database/movies.js and database/shows.js
 */
user_statistics.methods.get_recently_watched = async function(){
    let recent_array = [];

    for(let recent_media of this.recently_watched){
        let id = recent_media.id;
        let type = recent_media.type;

        if(type == "movie"){
            let movie = await Movies.get_movie(id);
            if(movie != null){
                recent_array.push(movie);
            }
        }
        else if(type == "show"){
            let show = await Shows.get_show(id);
            if(show != null){
                recent_array.push(show);
            }
        }

    }

    return recent_array;
}

/**
 * Add a movie or show to the users recently watched
 * @param {Number} id The id of the movie/show
 * @param {String} type The type of media, either movie/show
 */
user_statistics.methods.add_recently_watched = async function(id, type){
    let index = -1;//this is the index where the mediaId is located, if -1 that means it doesnt exist
    let max_details = 15;

    for(let i=0;i<this.recently_watched.length;i++){
        if(this.recently_watched[i].id == id){
            index = i;
            break;
        }
    }

    if(index != -1){
        let removedMedia = this.recently_watched.splice(index, 1);
        this.recently_watched.unshift(removedMedia[0]);
    }
    else{
        this.recently_watched.unshift({id: id, type: type});
    }

    if(this.recently_watched.length > max_details) {
        this.recently_watched = this.recently_watched.slice(0, max_details);
    }

    // await this.updateOne({$set: {recently_watched : this.recently_watched}});
    await this.save();

    // this.save();
}

/**
 * Removes all of the users recently watched
 */
user_statistics.methods.clear_recently_watched = async function(){
    this.recently_watched = [];
    await this.save();
}

/**
 * Updates the last online field to the time this method was called
 */
user_statistics.methods.update_last_online = async function(){
    this.last_online = new Date();
    await this.save();
}

user_statistics.methods.get_current_time = async function(id, type, season, episode){
    let media = this.recently_watched.find(element => element.type == type && element.id == id);
    
    if(media != undefined){
        if(type == "show"){
            let episodesArray = media.episodes;//get all the episodes array
            if(episodesArray != null){
                let existingEpisode = episodesArray.find(episodeEle => episodeEle.season == season && episodeEle.episode == episode);

                if(existingEpisode != undefined && existingEpisode != null){
                    return existingEpisode.current_time;
                }
                else{
                    return "0";
                }
            }
            return "0";
        }
        else if(type == "movie"){
            let current_time = media.current_time;
            if(current_time != undefined && current_time != null){
                return current_time;
            }
            else{
                return "0";
            }
        }
    }
}

user_statistics.methods.update_current_time = async function(id, type, season, episode, time){//updates the time the user was last left off
    let recentArray = this.recently_watched;

    let media = recentArray.find(element => element.type == type && element.id == id);

    if(media != undefined){
        if(type == "show"){//if the type is a show then keep track of the time position in each episode
            if(season != undefined && episode != undefined){//if the season or episode is not given, do not save to database
                let episodesArray = media.episodes;//get all the episodes array
                if(episodesArray == undefined || episodesArray == null){//if it doesnt exist add a new array
                    episodesArray = [];
                    media.episodes = episodesArray;
                }

                let existingEpisode = episodesArray.find(episodeEle => episodeEle.season == season && episodeEle.episode == episode);//if the current time has been saved before find it
                if(existingEpisode != undefined && existingEpisode != null){//checks if an existing episode has been saved, if so save the details to it
                    existingEpisode.current_time = time;
                    existingEpisode.season = season;
                    existingEpisode.episode = episode;
                }
                else{//if this episodes current time has never been saved before, creating a new episode object and push it to the episodes array
                    let newEpisode = {
                        season: season,
                        episode: episode,
                        current_time: time
                    };
                    episodesArray.push(newEpisode);
                }
                media.last_watched = {
                    season: season,
                    episode: episode
                }
                await this.updateOne({$set: {recently_watched : recentArray}});
            }
        }
        else if(type == "movie"){//if the type is a movie, you dont need an array, just simply store it with the media object
            media.current_time = time;
            await this.updateOne({$set: {recently_watched : recentArray}});
        }
    }
}

user_statistics.methods.clear_days_watched = async function(){
    this.days_watched = {};
    try{
        await this.save();
    } catch(err){
        console.log();
    }
}

module.exports = Mongoose.model("user_statistics", user_statistics);