const Mongoose = require("mongoose");
const config = require("@config");
const helper = require("@root/helper_functions");

let shows = new Mongoose.Schema({
    id: { //The TMDB id
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true,
        set: create_n_gram
    },
    description: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    frontpage: {
        type: String,
        required: true
    },
    backdrop: {
        type: String,
        required: true
    },
    logo: {
        type: String
    },
    runtime: {
        type: Number,
        required: true
    },
    release: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    uploaded_date: {
        type: Date,
        required: true
    },
    modified_date: {
        type: Date,
        required: true
    },
    genres: {
        type: Array,
        required: true
    },
    credits: {
        type: Object
    },
    seasons: {
        type: Map,
        required: true
    },
    search_title: {
        type: String
    }
}, {
    collections: config.collections.shows
});

shows.index({"title": "text", "description": "text"});

function create_n_gram(value){//this is used for searching
    if(value != null){
        this.search_title = helper.create_edge_n_grams(value);
    }
    return value;
}

/**
 * Searches for shows
 * NOTE: currently only searchs for movies by title
 * @param {String} search_query A search query
 * @param {Number} [limit=null] The amount of queries to limit the search, Example: put 10 if you only want to limit the search results to only 10 documents
 */
shows.statics.search = async function(search_query, limit){
    let pending_search  = this.find({$or: [{$text: {$search: search_query}}]});
    if(limit != null){
        pending_search.limit(limit);
    }
    return await pending_search.exec();
}

/**
 * Retrieves every show uploaded to movie buddy
 * @returns all the shows in Movie Buddy
 */
shows.statics.get_all_shows = async function(){
    let shows = await this.find({}).exec();
    return shows;
}

/**
 * Returns all shows sorted by genre
 * @param {Boolean} shuffle set to true if you want to shuffle the shows within genres, else set to false
 * @returns a json object that has shows sorted into genres
 */
 shows.statics.get_all_shows_by_genre = async function(shuffle){
    /**
     * Create database object called
     * Shows By Genre
     * (same thing with shows)
     * This will sort all of the shows by genre instead of having to process them each and everytime
     * shows: {
     *      genre1: [show1, show2, show3, ...],
     *      genre2: [show1, show2, show3, ...],
     *      ...
     * }
     */
    let shows = await this.find({}).exec();
    let shows_by_genre = {};

    shows.forEach(show => {
        let genres = show.genres;
        genres.forEach(genre => {
            let genre_name = genre.name;
            if(!shows_by_genre.hasOwnProperty(genre_name)){
                shows_by_genre[genre_name] = [];
            }
            shows_by_genre[genre_name].push(show);
        });
    });

    if(shuffle == true){
        let genres = Object.keys(shows_by_genre);
        genres.forEach(genre => {
            helper.shuffle(shows_by_genre[genre]);
        });
    }

    
    return shows_by_genre;
}

/**
 * Gets shows that are similar to the one requested,
 * It does this by iterating through every show in movie buddy
 * and compares how many genres match with each other
 * NOTE: this is very slow, TODO: put similar shows array into show object
 * @param {Number} show_id the show id
 * @returns a list of shows that is similar to the one requested, if show id does not exist returns empty list;
 */
shows.statics.get_similar_shows = async function(show_id){
    if(await this.has_show(show_id)){
        let matches = [];//[{show_id, num_of_matches}];
        let selected_show = await this.get_show(show_id);
        let selected_show_genres = selected_show.genres;
        let all_shows = await this.get_all_shows();
        for(let show of all_shows){
            if(show.id == selected_show.id){
                continue;
            }
            let show_genres = show.genres;
            let compare = (a1, a2) => a1.filter(v => a2.some(e => e.id == v.id)).length;
            let number_of_matches = compare(selected_show_genres, show_genres);
            matches.push({
                media: show,
                matches: number_of_matches
            });
        }

        matches.sort((ele1, ele2) => {
            return ele2.matches - ele1.matches
        });

        let modified_matches = [];
        for(let match of matches){
            modified_matches.push(match.media);
        }
        return modified_matches;
    }
    else{
        return [];
    }
}

/**
 * Checks to see if the database has a show based on the show id
 * @param {Number} show_id The show id
 * @returns true if the show exists, else returns false
 */
shows.statics.has_show = async function(show_id){
    if(helper.isInt(show_id)){
        let show = await this.findOne({id: show_id}).exec();
        return show != null;
    }
    return true;
}

/**
 * Fetchs an array of shows with the provided show ids
 * @param {Number[]} show_ids A list of show ids
 * @returns  a list of shows, if a show id doesn't exist it will just be empty
 */
shows.statics.fetch_movies = async function(show_ids){
    let shows = await this.find().where('id').in(show_ids).exec();

    return shows;
}

/**
 * Attempts to add a show to Movie Buddy
 * Note: This only adds the information of the show, this does not add the mp4, the mp4 must be store on the file system
 * 
 * Before calling this function, the json must match the Movie Schema
 * @param {Object} show_json A formatted json that is inline with the Movie Buddy format
 * @returns an object showing whether or not the operation was successful, if the operation of unsuccessful the object will contain a reason
 */
shows.statics.add_show = async function(show_json){
    let id = show_json.id;
    if(await this.has_show(id)){
        return {success: false, reason: "Show already exists in Movie Buddy"};
    }
    else{
        let show_document = new this(show_json);
        try {
            await show_document.save();
            return {success: true};
        } catch (err){
            console.log(err);
            return {success: false, reason: `${err.message}A fatal error has occurred, add_show()`};
        }
    }
}

/**
 * Fetchs a show object
 * @param {Number} show_id A show id
 * @returns the show object
 */
shows.statics.get_show = async function(show_id){
    if(helper.isInt(show_id)){
        let show = await this.findOne({id: show_id}).exec();
        return show;
    }
    return null;
}

shows.methods.get_episode = async function(season, episode){
    let seasons_object = this.seasons.get(String(season));
    if(seasons_object != null){
        let episode_object = seasons_object[String(episode)];
        return episode_object;
    }
    return null;
}

shows.methods.get_next_possible_episode = async function(curSeason, curEpi){
    let counter = 0;//this is to prevent an infinite loop

    let seasons_available = Array.from(this.seasons.keys());
    let foundSeasonIndex = seasons_available.indexOf(curSeason);//the index of the found season;
    if(foundSeasonIndex == -1){
        foundSeasonIndex = seasons_available.findIndex(season => season > curSeason);
        curSeason = seasons_available[foundSeasonIndex];
        curEpi = 0;
    }
    while(foundSeasonIndex != -1){
        counter++;
        let episodes = this.seasons.get(seasons_available[foundSeasonIndex]);
        let episode_keys = Object.keys(episodes);
        let foundEpisode = episode_keys.find(episode => episode > curEpi);
        if(foundEpisode != null){
            return await this.get_episode(curSeason, foundEpisode);
        }
        else{
            foundSeasonIndex = seasons_available.findIndex(season => season > curSeason);
            if(foundSeasonIndex != -1){
                curSeason = seasons_available[foundSeasonIndex];
                curEpi = 0;
            }
        }

        if(counter >= 30000){//no show has 30000 episodes, so break if this is exceed, this is to prevent infinite loop
            break;
        }
    }
    return null;
}

module.exports = Mongoose.model("shows", shows);