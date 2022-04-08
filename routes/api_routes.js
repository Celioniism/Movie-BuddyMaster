var express = require("express");
var router = express.Router();

var MovieDBConnector = require("@root/movie_database_connector.js");

/**
 * Searches for a list of movies based on a query
 * 
 * :query the query for the movie
 */
router.get("/api/movie/search/:query", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let query = req.params.query;
    if (query == null || query.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.search(query, "movie");
        res.send(result);
    }
});

/**
 * Retrieves one movie detail based on a movie id
 * 
 * :movie_id: the movie id
 */
router.get("/api/movie/:movie_id", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let movie_id = req.params.movie_id;

    if (movie_id == null || movie_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getMovieDetails(movie_id);
        res.send(result);
    }
});

/**
 * Gets all of the image urls that belong to a specific movie
 * 
 * :movie_id: the movie id
 * :type: the type of image, such as posters, backdrops, or logos
 */
router.get("/api/movie/images/:movie_id/:type?", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let movie_id = req.params.movie_id;
    let type = req.params.type;

    if (movie_id == null || movie_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getMovieImageDetails(movie_id);
        // if(type == null || !type.match(/posters|backdrops|logos/gm)){
        //     type = null;
        // }
        res.send(result);
    }
});

/**
 * Searches for a list of shows based on a query
 * 
 * :query the query for the show
 */
router.get("/api/show/search/:query", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let query = req.params.query;
    if (query == null || query.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.search(query, "show");
        res.send(result);
    }
});

/**
 * Retrieves one show detail based on a show id
 * 
 * :show_id: the show id
 */
router.get("/api/show/:show_id", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let show_id = req.params.show_id;

    if (show_id == null || show_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getShowDetails(show_id);
        res.send(result);
    }
});

/**
 * Gets all of the image urls that belong to a specific show
 * 
 * :show_id: the show id
 * :type: the type of image, such as posters, backdrops, or logos
 */
router.get("/api/show/images/:show_id/:type?", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let show_id = req.params.show_id;
    let type = req.params.type;

    if (show_id == null || show_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getShowImageDetails(show_id);
        // if(type == null || !type.match(/posters|backdrops|logos/gm)){
        //     type = null;
        // }
        res.send(result);
    }
});

/**
 * Retrieves one episode detail based on the show id, season number, and episode number
 * 
 * :show_id: the show id
 * :season the season the episode belongs to
 * :episode the episode of the episode
 */
router.get("/api/episode/:show_id/:season/:episode", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let show_id = req.params.show_id;
    let season = req.params.season;
    let episode = req.params.episode;

    if (show_id == null || show_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getEpisodeDetails(show_id, season, episode);
        res.send(result);
    }
});


/**
 * Gets all of the image urls that belong to a specific episode
 * 
 * :show_id: the show id
 * :season the season the episode belongs to
 * :episode the episode of the episode
 * NOTE: there is no type since it only has 1 type, stills
 */
router.get("/api/episode/images/:show_id/:season/:episode/:type?", async (req, res) => {
    if (req.user.type != "admin") {
        next();
    }
    let show_id = req.params.show_id;
    let season = req.params.season;
    let episode = req.params.episode;
    let type = req.params.type;

    if (show_id == null || show_id.length == 0) {
        res.send({});
    }
    else {
        let result = await MovieDBConnector.getEpisodeImageDetails(show_id, season, episode);
        // if(type == null || !type.match(/posters|backdrops|logos/gm)){
        //     type = null;
        // }
        res.send(result);
    }
});

module.exports = router;