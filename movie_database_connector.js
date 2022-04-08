var fetch = require("node-fetch");
var config = require("@config");

var api_key = config.tmdbApiKey;

//Helper Functions
async function getJson(url){    
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

/**
 * Retrieves all genres that exist the The Movie Database API
 * @param {String} type  The type of media, "movie", "show", or empty string or null 
 * @returns {JSON} a list of genres. if a type is not provided, will return all genres from both lists
 */
async function getAllGenres(type){
    if(type != "show" && type != "movie"){
        let genreArray = [];

        let show_result = await getAllGenres("show");
        let movie_result = await getAllGenres("movie");

        show_result.forEach(r => {
            if(genreArray.findIndex(genre => genre.id == r.id) == -1){
                genreArray.push(r);
            }
        });

        movie_result.forEach(r => {
            if(genreArray.findIndex(genre => genre.id == r.id) == -1){
                genreArray.push(r);
            }
        });
        return genreArray;
    }

    type = type == "show" ? "tv" : "movie";
    let url = `https://api.themoviedb.org/3/genre/${type}/list?api_key=${api_key}&language=en-US`
    let result = (await getJson(url)).genres;
    if(results == null){
        return [];
    }
    return result;
}

/**
 * Searchs The Movie Database API for a specific movie or show
 * @param {String} query  a search query
 * @param {String} type the type of media, either "movie", "show", "multi"
 * @param {Number} page what page to search
 */
async function search(query, type, page=1){
    if(type == null || !type.match(/movie|show|multi/gm)){
        type = "multi";
    }
    if(type == "show"){
        type = "tv";
    }
    let url = `https://api.themoviedb.org/3/search/${type}?query=${query}&api_key=${api_key}&page=${page}&include_adult=false&language=en-US`
    let results = (await getJson(url)).results;

    if(results == null){
        return {};
    }

    results = results.filter(searchEntry => {
        if(type == "multi"){
            return searchEntry.media_type == "tv" || searchEntry.media_type == "movie"
        }
        else{
            searchEntry.media_type = type;
            return true;
        }
    });

    return results;
}

/**
 * Gets all of the image data that belongs to a specific movie
 * Note: This does not retrieve any actual image, just where they are stored
 * @param {Number} movieId  The movie id that the movie belongs to
 */
async function getMovieImageDetails(movieId){
    let url = `https://api.themoviedb.org/3/movie/${movie_id}/images?api_key=${api_key}`;
    
    //retrieves the movie data from The Movie Database
    let image_details = await getJson(url);
    if(image_details == null){
        return {};
    }
    return image_details;
}

/**
 * Gets all of the image data that belongs to a specific show
 * Note: This does not retrieve any actual image, just where they are stored
 * @param {Number} showId  The show id that the movie belongs to
 */
async function getShowImageDetails(showId){
    let url = `https://api.themoviedb.org/3/tv/${showId}/images?api_key=${api_key}`;
    
    //retrieves the movie data from The Movie Database
    let image_details = await getJson(url);
    if(image_details == null){
        return {};
    }
    return image_details;
}

/**
 * Gets all of the image data that belongs to a specific episode
 * Note: This does not retrieve any actual image, just where they are stored
 * @param {Number} showId  The show id that the movie belongs to
 * @param {Number} season  the season 
 * @param {Number} episode  the episode
 */
async function getEpisodeImageDetails(showId, season, episode){
    let url = `https://api.themoviedb.org/3/tv/${showId}/season/${season}/episode/${episode}/images?api_key=${api_key}`;
    
    //retrieves the movie data from The Movie Database
    let image_details = await getJson(url);
    if(image_details == null){
        return {};
    }
    return image_details;
}

/**
 * Retrieves the movie details for a specific movie using its movie id
 * @param {String} movieId  The movie id that the movie belongs to
 */
async function getMovieDetails(movieId){
    let url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${api_key}&language=en-US`;
    
    //retrieves the movie data from The Movie Database
    let movie_details = await getJson(url);

    if(movie_details == null){
        return {};
    }

    let movie_credits = await getMovieCredits(movieId);
    movie_credits.cast.sort((ele1, ele2) => {
        return ele1.order - ele2.order
    });
    movie_credits.crew.sort((ele1, ele2) => {
        return ele1.order - ele2.order
    });

    let modified_credits = {
        cast: movie_credits.cast.splice(0, 30),
        crew: movie_credits.crew.splice(0, 30)
    }

    //parses out all of the fields that Movie Buddy will use
    let movie = {
        id: movie_details["id"],
        title: movie_details["title"],
        description: movie_details["overview"],
        rating: movie_details["vote_average"],
        frontpage: movie_details["poster_path"],
        backdrop: movie_details["backdrop_path"],
        // frontpage: `https://www.themoviedb.org/t/p/original${movie_details["poster_path"]}`,
        // backdrop: `https://www.themoviedb.org/t/p/original${movie_details["backdrop_path"]}`,
        runtime: movie_details["runtime"],
        release: movie_details["release_date"],
        type: "movie",
        uploaded_date: new Date(),
        modified_date: new Date(),
        genres: movie_details["genres"],
        credits: modified_credits
    }

    return movie;
}

/**
 * Retrieves the show details for a specific show using its show id
 * @param {String} showId  The show id that the show belongs to
 */
async function getShowDetails(showId){
    let url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${api_key}&language=en-US`;
    
    //retrieves the movie data from The Movie Database
    let show_details = await getJson(url);

    if(show_details == null){
        return {};
    }

    let show_credits = await getShowCredits(showId);

    show_credits.cast.sort((ele1, ele2) => {
        return ele1.order - ele2.order
    });
    show_credits.crew.sort((ele1, ele2) => {
        return ele1.order - ele2.order
    });

    let modified_credits = {
        cast: show_credits.cast.splice(0, 30),
        crew: show_credits.crew.splice(0, 30)
    }

    //parses out all of the fields that Movie Buddy will use
    let show = {
        id: show_details["id"],
        title: show_details["name"],
        description: show_details["overview"],
        rating: show_details["vote_average"],
        frontpage: show_details["poster_path"],
        backdrop: show_details["backdrop_path"],
        runtime: show_details["episode_run_time"][0],
        release: show_details["first_air_date"],
        type: "show",
        uploaded_date: new Date(),
        modified_date: new Date(),
        genres: show_details["genres"],
        credits: modified_credits
    }

    return show;
}

/**
 * Retrieves the episodes details for a specific show using its show id, season, and episode
 * @param {Number} showId  The show id that the show belongs to
 * @param {Number} season  The season
 * @param {Number} episode  The episode
 */
async function getEpisodeDetails(showId, season, episode){
    let url = `https://api.themoviedb.org/3/tv/${showId}/season/${season}/episode/${episode}?api_key=${api_key}&language=en-US`;
    
    let episode_details = await getJson(url);

    if(episode_details == null){
        return {};
    }

    //parses out all of the fields that Movie Buddy will use
    let episode_object = {
        title: episode_details["name"],
        description: episode_details["overview"],
        season: episode_details["season_number"],
        episode: episode_details["episode_number"],
        backdrop: episode_details["still_path"],
        release: episode_details["air_date"]
        // id: show_details["id"],
        // title: show_details["name"],
        // description: show_details["overview"],
        // rating: show_details["vote_average"],
        // frontpage: show_details["poster_path"],
        // backdrop: show_details["backdrop_path"],
        // runtime: show_details["episode_run_time"][0],
        // release: show_details["first_air_date"],
        // type: "show",
        // uploaded_date: new Date(),
        // modified_date: new Date(),
        // genres: show_details["genres"]
    }

    return episode_object;
}

/**
 * 
 */
async function getMovieCredits(movieId){
    let url = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${api_key}&language=en-US`;

    let credits = await getJson(url);

    if(credits == null){
        return {};
    }

    return credits;
}

/**
 * 
 */
async function getShowCredits(showId){
    let url = `https://api.themoviedb.org/3/tv/${showId}/credits?api_key=${api_key}&language=en-US`;

    let credits = await getJson(url);

    if(credits == null){
        return {};
    }

    return credits;
}

async function getPopular(){
    let url = `https://api.themoviedb.org/3/movie/popular?api_key=${api_key}&language=en-US&page=1`;
    
    //retrieves the movie data from The Movie Database
    let movies = await getJson(url);

    if(movies == null){
        return [];
    }
    return movies.results;
}


exports.getAllGenres = getAllGenres;

exports.getMovieDetails = getMovieDetails;
exports.getShowDetails = getShowDetails;
exports.getEpisodeDetails = getEpisodeDetails;

exports.getMovieImageDetails = getMovieImageDetails;
exports.getShowImageDetails = getShowImageDetails;
exports.getEpisodeImageDetails = getEpisodeImageDetails;

exports.getMovieCredits = getMovieCredits;
exports.getShowCredits = getShowCredits;

exports.getPopular = getPopular;
exports.search = search;

