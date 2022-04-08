const Mongoose = require("mongoose");
const config = require("@config");

const Movies = require("@collections/movies");
const Shows = require("@collections/shows");
const helper = require("@root/helper_functions");

let featured = new Mongoose.Schema({
    id: { //the TMDB id
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    }
}, {
    collections: config.collections.featured
});

/**
 * This only allows 1 id and type combination
 */
featured.index({id: 1, type: 1}, {unique: true});

/**
 * Gets all of the featured media details
 * @param {Boolean} randomize if you want the featured list to be randomized
 * @returns  an array of media
 */
featured.statics.get_featured_details = async function(randomize){
    let result = await this.find({}).exec();
    if(randomize){
        result = await helper.shuffle(result);
    }

    let media = [];

    for(let i=0;i<result.length;i++){
        let id = result[i].id;
        let type = result[i].type;

        if(type == "movie"){
            let movie = await Movies.get_movie(id);
            if(movie == null){
                continue;
            }
            media.push(movie);
        }
        else if(type == "show"){
            media.push(await Shows.get_show(id));
        }
    }

    return media;
}

/**
 * Gets all of the featured objects
 * 
 * Note: The difference between this function and get_featured_details 
 * is that get_featured_details retrieves everything about each individual movie/show
 * unlike this function where is only returns an array of featured objects which only include
 * the movie/show id and the type
 * @returns An array of all of the featured objects
 */
featured.statics.get_all_featured = async function(){
    let result = await this.find({}).exec();
    return result;
}

/**
 * Removes a movie/show from the featured list
 * @param {Number} id The id of the movie/show
 * @param {String} type The type of the media (movie/show)
 * @returns 
 */
featured.statics.remove_featured = async function(id, type){
    let removedQuery = await this.findOneAndDelete({id: id, type: type}).exec();
    return removedQuery != undefined;
}

/**
 * Adds a movie/show to the featured list
 * @param {Number} id The id of the movie/show
 * @param {String} type The type of the media (movie/show)
 * @returns an object showing whether or not the movie/show has been added or not, 
 * if the movie/show has successful been added then it will return an object that contains the media
 */
featured.statics.add_featured = async function(id, type){
    let media = undefined;
    if(type == "movie"){
        media = await Movies.get_movie(id);
    }
    if(type == "show"){
        media = await Shows.get_show(id);
    }
    
    if(media){
        let fields = {
            "id": id, 
            "type": type
        };
    
        let featured = new this(fields);
        try{
            await featured.save();
            return {success: true, media: media};
        } catch(err){
            if(err.code == 11000){
                return {success: false, reason: "Media already exists"};
            }
            else{
                return {success: false, reason: `MongoDB Code: ${err.code}`}
            }
        }
    }
    return {success: false};
}

module.exports = Mongoose.model("featured", featured);