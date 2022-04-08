const Mongoose = require("mongoose");
const config = require("@config");
const helper = require("@root/helper_functions");

let movies = new Mongoose.Schema({
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
    search_title: {
        type: String
    }
}, {
    collections: config.collections.movies
});

movies.index({"search_title": "text", "description": "text"});

function create_n_gram(value){//this is used for searching
    if(value != null){
        this.search_title = helper.create_edge_n_grams(value);
    }
    return value;
}

/**
 * Searches for movies
 * NOTE: currently only searchs for movies by title
 * @param {String} search_query A search query
 * @param {Number} [limit=null] The amount of queries to limit the search, Example: put 10 if you only want to limit the search results to only 10 documents
 */
movies.statics.search = async function(search_query, limit){
    let pending_search  = this.find({$or: [{$text: {$search: search_query}}]});
    if(limit != null){
        pending_search.limit(limit);
    }
    return await pending_search.exec();
}

/**
 * Retrieves every movie uploaded to movie buddy
 * @returns all the movies in Movie Buddy
 */
movies.statics.get_all_movies = async function(){
    let movies = await this.find({}).exec();
    return movies;
}

/**
 * Returns all movies sorted by genre
 * @param {Boolean} shuffle set to true if you want to shuffle the movies within genres, else set to false
 * @returns a json object that has movies sorted into genres
 */
movies.statics.get_all_movies_by_genre = async function(shuffle){
    /**
     * Create database object called
     * Movies By Genre
     * (same thing with shows)
     * This will sort all of the movies by genre instead of having to process them each and everytime
     * movies: {
     *      genre1: [movie1, movie2, movie3, ...],
     *      genre2: [movie1, movie2, movie3, ...],
     *      ...
     * }
     */
    let movies = await this.find({}).exec();
    let movies_by_genre = {};

    movies.forEach(movie => {
        let genres = movie.genres;
        genres.forEach(genre => {
            let genre_name = genre.name;
            if(!movies_by_genre.hasOwnProperty(genre_name)){
                movies_by_genre[genre_name] = [];
            }
            movies_by_genre[genre_name].push(movie);
        });
    });

    if(shuffle == true){
        let genres = Object.keys(movies_by_genre);
        genres.forEach(genre => {
            helper.shuffle(movies_by_genre[genre]);
        });
    }

    
    return movies_by_genre;
}

/**
 * Gets movies that are similar to the one requested,
 * It does this by iterating through every movie in movie buddy
 * and compares how many genres match with each other
 * NOTE: this is very slow, TODO: put similar movies array into movie object
 * @param {Number} movie_id the movie id
 * @returns a list of movies that is similar to the one requested, if movie id does not exist returns empty list;
 */
movies.statics.get_similar_movies = async function(movie_id){
    if(await this.has_movie(movie_id)){
        let matches = [];//[{movie_id, num_of_matches}];
        let selected_movie = await this.get_movie(movie_id);
        let selected_movie_genres = selected_movie.genres;
        let all_movies = await this.get_all_movies();
        for(let movie of all_movies){
            if(movie.id == selected_movie.id){
                continue;
            }
            let movie_genres = movie.genres;
            let compare = (a1, a2) => a1.filter(v => a2.some(e => e.id == v.id)).length;
            // console.log(selected_movie_genres, movie_genres);
            let number_of_matches = compare(selected_movie_genres, movie_genres);
            matches.push({
                media: movie,
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
 * Checks to see if the database has a movie based on the movie id
 * @param {Number} movie_id The movie id
 * @returns true if the movie exists, else returns false
 */
movies.statics.has_movie = async function(movie_id){
    if(helper.isInt(movie_id)){
        let movie = await this.findOne({id: movie_id}).exec();
        return movie != null;
    }
    return true;//if not an int, then the movie "exists"
}

/**
 * Fetchs an array of movies with the provided movie ids
 * @param {Number[]} movie_ids A list of movie ids
 * @returns  a list of movies, if a movie id doesn't exist it will just be empty
 */
movies.statics.fetch_movies = async function(movie_ids){
    let movies = await this.find().where('id').in(movie_ids).exec();

    return movies;
}

/**
 * Attempts to add a movie to Movie Buddy
 * Note: This only adds the information of the movie, this does not add the mp4, the mp4 must be store on the file system
 * 
 * Before calling this function, the json must match the Movie Schema
 * @param {Object} movie_json A formatted json that is inline with the Movie Buddy format
 * @returns an object showing whether or not the operation was successful, if the operation of unsuccessful the object will contain a reason
 */
movies.statics.add_movie = async function(movie_json){
    let id = movie_json.id;
    if(await this.has_movie(id)){
        return {success: false, reason: "Movie already exists in Movie Buddy"};
    }
    else{
        let movie_document = new this(movie_json);
        try {
            await movie_document.save();
            return {success: true};
        } catch (err){
            return {success: false, reason: "A fatal error has occurred, add_movie()"};
        }
    }
}

/**
 * Fetchs a movie object
 * @param {Number} movie_id A movie id
 * @returns the movie object
 */
movies.statics.get_movie = async function(movie_id){
    if(helper.isInt(movie_id)){
        let movie = await this.findOne({id: movie_id}).exec();
        return movie;
    }
    return null;
}

module.exports = Mongoose.model("movies", movies);