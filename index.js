const moduleAlias = require("module-alias");
moduleAlias.addAliases({
    "@root": __dirname,
    "@config": `${__dirname}/config.js`,
    "@collections": `${__dirname}/database`,
    "@routes": `${__dirname}/routes`

});
require("module-alias/register");

var config = require("@config");

var informationFilled = config.isInformationFilled();
if (informationFilled.result != true) {
    console.log(`Movie Buddy Failed to Start: ${informationFilled.reason}`);
    process.exit(1);
}

var express = require("express");
var http = require("http");
var fs = require("fs");
var path = require("path");
var https = require("https");
var helmet = require("helmet");
var sharp = require("sharp");
var expressDevice = require("express-device");
var expressip = require('express-ip');
var ejs = require("ejs");
var purify = require("isomorphic-dompurify");
const random_string = require("randomstring");

var { getAverageColor } = require('fast-average-color-node');

var {DateTime, Interval} = require("luxon");

//Passport Modules
var express_session = require("express-session");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var connect_ensure_login = require('connect-ensure-login');

//Collections 
var Movies = require("@collections/movies.js");
var Shows = require("@collections/shows.js");
var User = require("@collections/users.js");
var Featured = require("@collections/featured.js");

//File Manager to manage movies, shows, uploads, and images
var FileManager = require("@root/file_manager.js");

//Helper Functions
var helper = require("@root/helper_functions");


//MongoDB Modules
var mongoose = require("mongoose");
const MongoStore = require('connect-mongo');
var mongo_db_store = new MongoStore({
    mongoUrl: config.mongoDBUri
});
//Connect to the MongoDB Database
mongoose.connect(config.mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("Database connection successful")
    })
    .catch(err => {
        console.error(err)
    });

var app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(expressip().getIpInfoMiddleware);
app.use(expressDevice.capture({parseUserAgent: true}));
expressDevice.enableDeviceHelpers(app);

//Body Parser, mainly for forms
app.use(express.urlencoded({ extended: true }));//use body parser
app.use(express.json());//allow for JSON bodyParseing
app.use(expressDevice.capture({parseUserAgent: true}));
//Use helmet for security
app.use(helmet({ contentSecurityPolicy: false }));

//Routes
var authentication_routes = require("@routes/authentication_routes.js");
var settings_routes = require("@routes/settings_routes.js");
var feedback_routes = require("@routes/feedback_routes.js");
var request_routes = require("@routes/request_routes.js");
var upload_routes = require("@routes/upload_routes.js");
var profile_routes = require("@routes/profile_routes.js");
var watch_routes = require("@routes/watch_routes.js");
var admin_routes = require("@routes/admin_routes.js");
var my_list_routes = require("@routes/my_list_routes.js");
var api_routes = require("@routes/api_routes.js");

//passport stuff
passport.use(new LocalStrategy({
    usernameField: "email_input",
    passwordField: "password_input"
},
    async function (email, password, done) {
        let response = null;
        email = email != null ? email.toLowerCase().trim() : "";
        try {
            response = await User.validate_user(email, password);
        } catch (err) {
            return done(err);
        }
        if (response != null) {//the response is not null meaning nothing severe went wrong
            if (response["success"] == true) {
                return done(null, response.user, { success: true, redirect: "/" });
            }
            else {
                return done(null, false, response);
            }
        }
    }));

passport.serializeUser(function (user, done) {
    done(null, user._id);
});

passport.deserializeUser(async function (id, done) {
    let user = null;
    try {
        user = await User.get_details(id);
    } catch (err) {
        done(err);
    }

    if (user != null) {
        done(null, user);
    }
});

var express_session_function = express_session({
    secret: "secret",//should be placed in config.js
    saveUninitialized: false, // don't create session until something stored
    resave: false, //don't save session if unmodified
    store: mongo_db_store,
    cookie: { maxAge: 3 * 24 * 60 * 60 * 1000 }
})

app.use(express_session_function);

app.use(passport.initialize());
app.use(passport.session());

//This resets all app.locals variables
app.use((req, res, next) => {
    req.store = mongo_db_store;
    next();
});

/***********************
 * 
 * Unprotected Routes
 * Anyone can access these pages
 * 
 ***********************/
app.use("/", authentication_routes);

//ensure that the user is logged in, and if the user is logged in let the user proceed
app.use(
    connect_ensure_login.ensureLoggedIn("/login"),
    function (req, res, next) {
        res.locals.type = req.user.type ? req.user.type : "regular";
        res.locals.username = `Hi, ${req.user.first_name}`;
        res.locals.global_profile_picture = req.user.profile_picture != null ? `/profile_image${req.user.profile_picture}` : "";
        next();
    });

/***********************
 * 
 * Protected Routes
 * Only people with an account can access these pages
 * 
 ***********************/

app.get("/first_time", (req, res) => {//temporary route location
    res.render("setup_page");
});

//Image Route
app.get("/images/:filename", async (req, res) => {
    let filename = req.params.filename;//the image name
    let width = req.query.width;
    let height = req.query.height;
    let fit = req.query.fit;
    let type = req.query.type;// percentage or pixels (default: pixels)
    
    if (width == null || !helper.isInt(width)) {
        width = null;
    }
    if (height == null || !helper.isInt(height)) {
        height = null;
    }
    if(fit == null || !fit.match(/cover|contain|fill|inside|outside/gm)){
        fit = null;
    }
    if(type == null || !type.match(/percentage|pixels/gm)){
        type = null;
    }

    let file_path = path.join(config.movieBuddyFolder, "images", filename);
    if (!fs.existsSync(file_path)) {
        res.redirect("/404");
    }
    else {
        if(width == null && height == null){
            res.sendFile(file_path);
        }
        else{

            let int_width =  width != null ? parseInt(width) : null;
            let int_height =  height != null ? parseInt(height) : null;
            const image = sharp(file_path);
            const metaData = await image.metadata();

            if(type != null && type == "percentage"){
                int_width = int_width != null ? Math.round(metaData.width * (int_width/100)) : null;
                int_height = int_height != null ? Math.round(metaData.height * (int_height/100)) : null;
            }

            const resized = await image.resize({
                width: int_width,
                height: int_height,
                fit: fit
            }).toBuffer();
            
            res.writeHead(200, {
                'Content-Type': `image/${metaData.format}`,
                'Content-Length': resized.length
            });
            res.end(resized); 
        }
    }
});

//Used to track last online
app.use(async (req, res, next) => {
    let user = req.user;
    let stats = await user.get_statistics();

    let today = DateTime.now();

    if(stats){
        if(stats.last_online){
            let last_online = DateTime.fromJSDate(new Date(stats.last_online));
            let interval = Interval.fromDateTimes(last_online, today);
            if(interval.length("minutes") > 1){//only update last online every 1 minutes
                stats.update_last_online();
            }
        }
        else{
            stats.update_last_online();
        }
    }
    
    //Update last online for the current session
  //  let current_session = req.session.user_session_details;
   // if(current_session.last_online == undefined){
    //    current_session.last_online = new Date();
    //}
    //else{
     //   let last_online_for_session = DateTime.fromJSDate(new Date(current_session.last_online));
      //  let interval = Interval.fromDateTimes(last_online_for_session, today);
       // if(interval.length("minutes") > 1){//if last login was more than 1 minute ago, then update last login, no need to update this after every image request
         //   current_session.last_online = new Date();
        //}
    //}
    next();
});

//Home Page
app.get("/", async (req, res) => {
    let user = req.user;
    let stats = await user.get_statistics();
    let movies = await Movies.get_all_movies_by_genre(true);
    let shows = await Shows.get_all_shows_by_genre(true);
    let featured = await Featured.get_featured_details(true);
    let recently_watched = null;
    let my_list = null;
    if(stats != null){
        recently_watched = await stats.get_recently_watched();
        my_list = await stats.get_list();
    }

    let show_keys = Object.keys(shows);
    for(let key of show_keys){
        if(movies.hasOwnProperty(key)){
            movies[key].push(...shows[key]);
        }
        else{
            movies[key] = shows[key];
        }
    }

    res.render("homepage", { 
        movies: movies, 
        featured: featured, 
        image_path: "/images",
        recently_watched: recently_watched,
        my_list: my_list});
});

//About Page
app.get("/about", (req, res) => {
    res.render("about_page");
});

app.get("/search", async (req, res) => {
    res.render("search_page");
});

app.get("/search/search_row/:query", async (req, res) => {
    let search_query = purify.sanitize(req.params.query);

    if (search_query == null || search_query.length == 0) {
        res.redirect("/404");
        return;
    }

    let movies = await Movies.search(search_query);
    let shows = await Shows.search(search_query);

    let movie_row_path = `${__dirname}/views/snippets/movie_row.ejs`
    let movie_row = "";
    if(movies.length != 0){
        movie_row = await ejs.renderFile(movie_row_path, {
            title: "Movies",
            movies: movies,
            image_path: "/images" });
    }

    let show_row = "";
    if(shows.length != 0){
        show_row = await ejs.renderFile(movie_row_path, {
            title: "Shows",
            movies: shows,
            image_path: "/images" });
    }
        
    res.send({movie_row: movie_row, show_row: show_row});
});

app.get("/search_media/:query", async (req, res) => {
    let search_query = purify.sanitize(req.params.query);

    if (search_query == null || search_query.length == 0) {
        res.redirect("/404");
        return;
    }

    let movies = await Movies.search(search_query);
    let shows = await Shows.search(search_query);
    movies.push(...shows);
    res.send(movies);

});

app.get("/movies", async (req, res) => {
    let movies = await Movies.get_all_movies_by_genre(true);

    res.render("movies", { 
        movies: movies, 
        image_path: "/images" });
});

app.get("/shows", async (req, res) => {
    let shows = await Shows.get_all_shows_by_genre(true);

    res.render("shows", { 
        shows: shows, 
        image_path: "/images" });
});

app.use("/media_modal/:type/:id", async (req, res) => {
    let type = req.params.type;
    let id = req.params.id;
    let user = req.user;
    let stats = await user.get_statistics();

    

    let media = null;
    let similar_movies = [];
    if(type == "movie"){
        media = await Movies.get_movie(id);
        similar_movies = await Movies.get_similar_movies(id);
    }
    else if(type == "show"){
        media = await Shows.get_show(id);
        similar_movies = await Shows.get_similar_shows(id);
    }
    similar_movies = similar_movies.slice(0, 6);

    if(media != null){
        let is_in_list = false;
        if(stats){
            is_in_list = await stats.in_list(id, type);
        }

        let color = null;
        if(media.backdrop != null && media.backdrop.length != 0){
            let file_path = path.join(config.movieBuddyFolder, "images", media.backdrop);
            try{
                color = await getAverageColor(file_path);
            } catch(err){
                // console.log(err);
            }
        }

        // let last_episode = 
        let file_path = `${__dirname}/views/snippets/media_details_modal.ejs`;
        let modal = await ejs.renderFile(file_path, {
            media: media, 
            color: color, 
            helper: helper, 
            similar_movies: similar_movies,
            image_path: "/images",
            is_in_list: is_in_list});
            
        res.send({modal: modal});

        return;
    }

    res.send({});
});

//Request Routes
app.use("/", request_routes);

//My List Routes
app.use("/", my_list_routes);

//Feedback Routes
app.use("/", feedback_routes);

//Profile Routes
app.use("/", profile_routes);

//Settings Routes
app.use("/", settings_routes);

//Watch Routes
app.use("/", watch_routes);

//Upload Routes
app.use("/", upload_routes);

//API Routes
app.use("/", api_routes);

//Admin Routes
app.use("/", admin_routes);

app.use(function (req, res, next) {
    // console.log("errr", err);
    res.status(404).render('404');
});

//Creates all the necessary folders to store movie/show information, user uploads, and media images
FileManager.create_file_system();

/****************
 * 
 * This will configure the server to either run using HTTP or HTTPS depending on whether or not the config fields are filled
 * 
 ****************/
var port = config.port;
var passphrase = config.security.passphrase;
var keyFile = "";
var certificateFile = "";
var useHttps = false;

if (config.security.keyLocation.length != 0 && config.security.certificateLocation.length != 0) {
    keyFile = fs.readFileSync(config.security.keyLocation);
    certificateFile = fs.readFileSync(config.security.certificateLocation);
    useHttps = true;
}
if (useHttps) {//if key and ceritificate location are found, then use HTTPS, else use HTTP
    https.createServer({
        key: keyFile,
        cert: certificateFile,
        passphrase: passphrase
    }, app).listen(port, () => {
        console.log(`Movie Buddy has successfully start using HTTPS on port : ${port}`);
    });
}
else {
    const server = http.Server(app);
    const io = require('socket.io')(server);

    server.listen(port, () => {
        console.log(`Movie Buddy has successfully start using HTTP on port : ${port}`);
    });;

    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

    // Set up the Socket.IO server

    let watch_party_space = io.of("/watch_party");
    watch_party_space.use(wrap(express_session_function));

    watch_party_space.use(function (socket, next) {
        let session = socket.request.session;
        if(session != null){
            let passport = session.passport;
            if(passport != null){
                let user_id = passport.user;
                if(user_id != null){
                    // console.log(user_id);
                    next();
                }
            }
        }
        
        next(new Error("No Authentication"));
    });


    watch_party_space.on("connection",  function (socket) {
        
        socket.on("disconnecting", async () => {
            //Check to see if the user is currently in a room
            let in_room = false;
            let current_room = "";
            for(let room of socket.rooms){
                if(room.startsWith("room_")){
                    current_room = room;
                    in_room = true;
                    break;
                }
            }
            if(in_room){
                let user_id = socket.request.session.passport.user;
                let user = await User.get_details(user_id);
                let username = "No Name";
                if(user){
                    username = user.username;
                }
                socket.to(current_room).emit("watch_party:user_left", username);
            }
        });

        socket.on('watch_party:create_room', (time) => {
            if(isNaN(time)){
                time = 0;
            }

            //Check to see if the user is currently in a room
            let in_room = false;
            for(let room of socket.rooms){
                if(room.startsWith("room_")){
                    in_room = true;
                    break;
                }
            }
            if(in_room){
                socket.emit("watch_party:error", "Seems like you are already connected to a room");
            }
            else{
                //generate a random room_id
                let room_id = `room_${random_string.generate(16)}`;
    
                //let socket join the room
                socket.join(room_id);
    
                //send the room_id
                socket.emit("watch_party:room_created", room_id);
            }
        });

        socket.on("watch_party:join_party", async (room_id) => {
            //Check to see if the user is currently in a room
            let in_room = false;
            for(let room of socket.rooms){
                if(room.startsWith("room_")){
                    in_room = true;
                    break;
                }
            }
            if(in_room){
                socket.emit("watch_party:error", "Seems like you are already connected to a room"); 
            }
            else{
                //check to see if the room exists
                if(io.of("/watch_party").adapter.rooms.has(room_id)){
                    // console.log("Added : " + party_rooms[room_id].add_user(socket), socket.id, socket != null, socket.id != null);

                    socket.join(room_id);
                    socket.emit("watch_party:room_joined_confirmed", 0);//recommended to request current time
                    
                    let user_id = socket.request.session.passport.user;
                    let user = await User.get_details(user_id);
                    let username = "No Name";
                    if(user){
                        username = user.username;
                    }
                    socket.to(room_id).emit("watch_party:user_joined", username);
                }
                else{
                    socket.emit("watch_party:room_does_not_exist", "Room doesn't exist");
                }
            }
        });

        socket.on("watch_party:chat", async (room_id, message) => {
            //check to see if the user is in the room
            if(!socket.rooms.has(room_id)){
                socket.emit("watch_party:error", "It appears you aren't in this room");
            }
            else{
                //check to see if the room exists//technically this should never be called
                if(!io.of("/watch_party").adapter.rooms.has(room_id)){
                    socket.emit("watch_party:error", "It appears the room doesn't exist");
                }
                else{
                    let user_id = socket.request.session.passport.user;
                    let user = await User.get_details(user_id);
                    let username = "No Name";
                    if(user){
                        username = user.username;
                    }
                    socket.to(room_id).emit("watch_party:chat", username, message);
                }
            }
        });

        socket.on('watch_party:play', (room_id, time) => {
            if(!isNaN(time)){
                //check to see if the user is in the room
                if(!socket.rooms.has(room_id)){
                    socket.emit("watch_party:error", "It appears you aren't in this room");
                }
                else{
                    //check to see if the room exists//technically this should never be called
                    if(!io.of("/watch_party").adapter.rooms.has(room_id)){
                        socket.emit("watch_party:error", "It appears the room doesn't exist");
                    }
                    else{
                        socket.to(room_id).emit("watch_party:play", time);
                    }
                }
            }
        });
    
        socket.on('watch_party:pause', (room_id) => {  
            //check to see if the user is in the room
            if(!socket.rooms.has(room_id)){
                socket.emit("watch_party:error", "It appears you aren't in this room");
            }
            else{
                //check to see if the room exists//technically this should never be called
                if(!io.of("/watch_party").adapter.rooms.has(room_id)){
                    socket.emit("watch_party:error", "It appears the room doesn't exist");
                }
                else{
                    socket.to(room_id).emit("watch_party:pause");
                }
            }
        });
    
        socket.on('watch_party:seek', (room_id, time) => {
            if(!isNaN(time)){
                if(!socket.rooms.has(room_id)){
                    socket.emit("watch_party:error", "It appears you aren't in this room");
                }
                else{
                    //check to see if the room exists//technically this should never be called
                    if(!io.of("/watch_party").adapter.rooms.has(room_id)){
                        socket.emit("watch_party:error", "It appears the room doesn't exist");
                    }
                    else{
                        socket.to(room_id).emit("watch_party:seek", time);
                    }
                }
            }
        });
    });
}

