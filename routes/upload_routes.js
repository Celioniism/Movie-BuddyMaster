var express = require("express");
var formidable = require("formidable");
var path = require("path");
var fs = require("fs");
var config = require("@config");
var helper = require("@root/helper_functions");

var Movies = require("@collections/movies.js");
var Shows = require("@collections/shows.js");
var UserUploads = require("@collections/user_uploads.js");
var FileManager = require("@root/file_manager.js");

var router = express.Router();

/**
 * Gets all of the files uploaded from a single user
 * if an extension is provided then it will only return files with that extension
 * query parameters: extensions
 */
router.get("/upload/files", async (req, res) => {
    if(req.user.type != "admin"){
        next();
    }
    let extensions = req.query.extensions;
    let extensions_array = [];
    if(extensions != null){
        if(extensions.constructor.name == "Array"){
            extensions_array = extensions;
        }
        else if(extensions.constructor.name == "String"){
            extensions_array.push(extensions);
        }
    }

    let user = req.user;
    let uploads = await UserUploads.get_user_uploads(user._id, extensions_array);
    
    res.send(uploads);
});

router.get("/upload/movie", (req, res, next) => {
    /**
     * When a file has been uploaded, keep track of:
     * User - user who uploaded the file
     * Date Uploaded - When the user has uploaded the file. Each file will have an expiration date
     * Expiration Date - Every file uploaded will be delete after a certain amount of time (7 days)
     * Original File Name - The original file name
     * File Size - the size of the file
     * 
     * System File Name - A filename for the file that is generated when a file is uploaded
     * File Name - This will be set ot the Original File Name when this file is uploaded. This name is only stored in the database and can be modified by the user how they so please
     */
    if(req.user.type != "admin"){
        next();
    }
    else{
        res.render("admin/upload_movie", {helper: helper});
    }
});

router.post("/upload/movie/send", async (req, res, next) => {
    if(req.user.type != "admin"){
        next();
    }
    let upload_details = req.body;
    let uploaded_movie_details = upload_details.movie_details;
    let selected_file_id = upload_details.selected_mp4;
    let subtitles = upload_details.subtitles;
    let user = req.user;

    //Checks if the file selected belongs to the current user
    let file_belongs_to_user = await UserUploads.belongs_to(selected_file_id, user._id);
    if(!file_belongs_to_user){
        res.send({success: false, reason: "The file you have selected does not belong to you!"});
        return;
    }

    let selected_file_object = await UserUploads.get_upload(selected_file_id);

    //Check if the file exists in the database
    if(selected_file_object == null){
        res.send({success: false, reason: "The file you have selected does not exist."});
        return;
    }

    //check if the selected file exists on the file system
    if(!fs.existsSync(selected_file_object.file_path)){
        res.send({success: false, reason: "The file you have selected does not exist!"});
        return;
    }

    //check if all of the subtitle files exist
    if(subtitles != null){
        for(let subtitle of subtitles){
            let sub_file_id = subtitle.subtitle_file_id;
            let sub_file_object = await UserUploads.get_upload(sub_file_id);
            if(sub_file_object == null || !fs.existsSync(sub_file_object.file_path)){
                res.send({success: false, reason: "One or more subtitle files do not exist!"});
                return;
            }
            else{//next check if the language name and code have file safe names
                let sub_language_name = subtitle.language_name;
                let sub_language_code = subtitle.language_code;
                if(sub_language_name == null || sub_language_name.trim().length == 0 || sub_language_name.length == 0){
                    res.send({success: false, reason: `The file ${sub_file_object.original_file_name} cannot have an empty language name.`});
                    return;
                }
                if(sub_language_code == null || sub_language_code.trim().length == 0 || sub_language_code.length == 0){
                    res.send({success: false, reason: `The file ${sub_file_object.original_file_name} cannot have an empty language name.`});
                    return;
                }

                if(!helper.valid_file_name(sub_language_name) || !helper.valid_file_name(sub_language_code)){
                    res.send({success: false, reason: `The file ${sub_file_object.original_file_name} does not have a valid language name or code.`});
                    return;
                }
            }
        }
    }

    let file_current_location = selected_file_object.file_path;
    let file_extension = path.extname(file_current_location);

    
    //TODO
    //verify that the data has not been tampered with
    //ensure that all of the keys exist, if not reject
    // let object_map = {
    //     id: {type: "Number", sanitize: true, parse: "number"},
    //     title: {type: "String", sanitize: true},
    //     description: {type: "String", sanitize: true},
    //     rating: {type: "Number", sanitize: true, parse: "number"},
    //     frontpage: {type: "String", sanitize: true},
    //     backdrop: {type: "String", sanitize: true},
    //     logo: {type: "String", sanitize: true},
    //     runtime: {type: "Number", sanitize: true, parse: "number"},
    //     release: {type: "String", sanitize: true},
    //     type: {type: "String", sanitize: true},
    //     uploaded_date: {type: "Date", parse: "date"},
    //     modified_date: {type: "Date", parse: "date"},
    //     genres: {type: "Array"},
    // }
    // let options = {
    //     return_extra_keys: true,
    //     remove_extra_keys: true
    // }
    
    // uploaded_movie_details = helper.object_validator(uploaded_movie_details, object_map, options).object;

    let movie_id = uploaded_movie_details.id;

    //Checks if the movie already exists
    let has_movie = await Movies.has_movie(movie_id);
    if(has_movie){
        res.send({success: false, reason: "This movie already exists in Movie Buddy"});
        return;
    }

    let poster_image_url = uploaded_movie_details.frontpage;
    let backdrop_image_url = uploaded_movie_details.backdrop;
    let logo_image_url = uploaded_movie_details.logo;

    let poster_file_name = "";
    if(poster_image_url != null){
        poster_file_name = path.basename(poster_image_url);
    }
    let backdrop_file_name = "";
    if(backdrop_image_url != null){
        backdrop_file_name = path.basename(backdrop_image_url);
    }
    let logo_file_name = "";
    if(logo_image_url != null){
        logo_file_name = path.basename(logo_image_url);
    }

    let root = config.movieBuddyFolder;
    let movies_folder = path.join(root, "movies");
    let images_folder = path.join(root, "images");
    let the_movie_folder = path.join(movies_folder, String(movie_id));
    let movie_subtitle_folder = path.join(the_movie_folder, "subtitles");
    
    //In Future, Save all of the file paths and then if an error occurs delete all of the files that were downloaded
    //Downloads all three images and stores them in the images folder
    FileManager.download_image(poster_image_url, path.join(images_folder, poster_file_name), (err) => {poster_file_name = ""});
    FileManager.download_image(backdrop_image_url, path.join(images_folder, backdrop_file_name), (err) => {backdrop_file_name = ""});
    FileManager.download_image(logo_image_url, path.join(images_folder, logo_file_name), (err) => {logo_file_name = ""});

    //Replace the frontpage and backdrop and logo original urls with just the image filename
    uploaded_movie_details.frontpage = `${poster_file_name}`;
    uploaded_movie_details.backdrop = `${backdrop_file_name}`;
    uploaded_movie_details.logo = `${logo_file_name}`;

    //create the movie directory for this specific movie
    FileManager.ensure_directory_existence(the_movie_folder);
    //create the subtitles directory for this specific movie
    FileManager.ensure_directory_existence(movie_subtitle_folder);

    //write the movie details to a json in the movie directory
    FileManager.write_json_to_file(JSON.stringify(uploaded_movie_details, null, 4), path.join(the_movie_folder, `${movie_id}_details.json`));

    //Move selected file to movie directory
    FileManager.move_file(file_current_location, path.join(the_movie_folder, `${movie_id}${file_extension}`));

    //After selected file has been moved, delete it from the user_uploads database
    await UserUploads.delete_user_upload(selected_file_object._id);
    
    //Move all subtitle files to their correct folder
    if(subtitles != null){
        for(let subtitle of subtitles){
            let sub_file_id = subtitle.subtitle_file_id;
            let sub_language_name = subtitle.language_name;
            let sub_language_code = subtitle.language_code;

            let sub_file_object = await UserUploads.get_upload(sub_file_id);
            let sub_file_path = sub_file_object.file_path;
            let sub_file_extension = path.extname(sub_file_path);

            if(sub_file_object != null || fs.existsSync(sub_file_path)){
                FileManager.move_file(sub_file_object.file_path, path.join(movie_subtitle_folder, `${movie_id}_${sub_language_name}_${sub_language_code}${sub_file_extension}`));

                //After selected file has been moved, delete it from the user_uploads database
                await UserUploads.delete_user_upload(sub_file_object._id);
            }
        }
    }

    //Adds the movie to the database
    let add_movie_result = await Movies.add_movie(uploaded_movie_details);

    res.send(add_movie_result);
});

router.post("/upload/files/send", async (req, res, next) => {
    if(req.user.type != "admin"){
        next();
    }

    let upload_folder = path.join(config.movieBuddyFolder, "uploads");

    /**
     * This makes sure that the folder upload exists before adding files to it
     * NOTE: probably should put in file directory
     */
    FileManager.ensure_directory_existence(upload_folder);

    //Set up formidable
    const form = formidable({
        multiples: true,
        uploadDir: upload_folder,//ensure that the directory exists before uploading
        keepExtensions: true,
        maxFileSize: 1024  * 1024 * 1024 * 3//max upload size 3 gb
    });

    //This adds the users upload to the database
    let addUpload = async function(file){
        let user = req.user;
        let date_uploaded = new Date();
        let expiration = new Date();
        expiration.setDate(date_uploaded.getDate() + 7);

        let upload_result = await UserUploads.add_user_upload(
            user._id,//user id
            date_uploaded,//date uploaded
            expiration,//date to delete
            file.size,//file size
            file.path,//file path
            file.name,//file original name
            path.basename(file.path),//file storage name
            file.name//custom file name
        );
        return upload_result;
    }
        
    let results = {};
    //Checks if the file has the right extension, if not then do not upload to file system
    form.onPart = function (part) {
        if(!part.filename.match(/\.(mp4|ssa|vtt|png)$/)){
            results[part.filename] = {success: false, reason: "Unsupported file type."}
            res.send(results);
        }
        else{
            form.handlePart(part);
        }
    }

    //If the file has passed the extension check, then continue processing the file
    form.parse(req, async (err, fields, files) => {
        if (err) {
            // next(err);
            results["Error"] = {success: false, reason: err.message}
            res.send(results);
            return;
        }
        //This makes sure that the front-end code has not been modified
        let all_files_keys = Object.keys(files).filter(key => key != "movie_uploads");

        //Gets the files from the file chooser named "movie_uploads"
        let movie_uploads = files["movie_uploads"];
        if(movie_uploads != null){
            if(movie_uploads.constructor === Array){
                for(let i=0;i<movie_uploads.length;i++){
                    let file = movie_uploads[i];
                    let result = await addUpload(file);
                    results[file.name] = result;
                }
            }
            else{
                let result = await addUpload(movie_uploads);
                results[movie_uploads.name] = result;
            }
        }
        
        /**
         * This should never be called unless someone tampers with the front-end code
         * This will remove all of the files that do not belong
         * This makes sure that it only reads the files from the input element with the name movie_uploads
         * If there is more than 1 input element or if a person changes the input elements name, then it will make sure to delete the files that are not valid
         */
        all_files_keys.forEach(file_key => {
            let file = files[file_key];
            if(file != null){
                if(file.constructor === Array){
                    file.forEach(file => {
                        let absolutePath = path.resolve(file.path);
                        fs.unlinkSync(absolutePath);
                    });
                }
                else{
                    let absolutePath = path.resolve(file.path);
                    fs.unlinkSync(absolutePath);
                }
            }
        });
    });

    form.on("end", () => {
        res.send(results);
    });
});

router.get("/upload/show", (req, res, next) => {
    if(req.user.type != "admin"){
        next();
    }
    else{
        res.render("admin/upload_show");
    }
});

router.post("/upload/show/send", async (req, res) => {
    if(req.user.type != "admin"){
        next();
    }
    else{
        let user = req.user;
        let user_id = user._id;
        let body = req.body;
        let selected_show = body.selected_show;
        let episodes_list = body.episodes != null ? body.episodes: [];

        if(episodes_list.length == 0){
            res.send({success: false, reason: "You must add atleast one episode to the show"});
            return;
        }

        // console.log(body);

        /*
            this object keeps track of all of the episodes that have been checked, 
            checked meaning that the episode belongs to the user, the subtitles exist, episode file exists, etc.
            {season_num : [episode1, episode2]}
        */
        let episode_tracker_list = {};
        
        //Iterate through all of the episodes and see if the episodes exist and if they belong to the user
        for(let episode of episodes_list){
            let episode_file_id = episode.file_id;
            let episode_subtitles = episode.subtitles;
            let episode_season = episode.season != null ? episode.season.trim() : "";
            let episode_episode = episode.episode != null ? episode.episode.trim() : "";

            //Checks if the season and episode are valid Integers
            if(!helper.isInt(episode_season) || !helper.isInt(episode_episode)){
                res.send({success: false, reason: "One of the seasons/episodes are not in the form of an Integer"});
                return;
            }

            let episode_season_string = String(episode_season);
            //Checks to see the season is available in the episode_tracker_list, if not create it
            if(!episode_tracker_list.hasOwnProperty(episode_season_string)){
                episode_tracker_list[episode_season_string] = [];
            }

            //Checks to see if the episode exists in the season array, if it does exist that means that the user entered a duplicate episode
            //If there is a duplicate episode, then send an error back to the user
            if(episode_tracker_list[episode_season_string].includes(episode_episode)){
                res.send({success: false, reason: "There seems to be a duplicate episode, please correct the error"});
                return;
            }
            else{//if there is no duplicate episode, add it to the season list
                episode_tracker_list[episode_season_string].push(episode_episode);
            }

            //checks if the file belongs to the user
            let belongs = await UserUploads.belongs_to(episode_file_id, user_id);
            if(!belongs){//if the file does not belong to the user then stop the loop and send a response back
                res.send({success: false, reason: "One of the files you have selected does not belong to you!"});
                return;
            }
            
            let episode_upload = await UserUploads.get_upload(episode_file_id);

            //Check if the file exists in the database, the if statement above will basically handle this
            if(episode_upload == null){
                res.send({success: false, reason: "The file you have selected does not exist."});
                return;
            }
    
            //check if the selected file exists on the file system
            if(!fs.existsSync(episode_upload.file_path)){
                res.send({success: false, reason: "The file you have selected does not exist!"});
                return;
            }

            //check if all of the subtitle files exist
            if(episode_subtitles != null){
                for(let subtitle of episode_subtitles){
                    let sub_file_id = subtitle.subtitle_file_id;
                    let sub_file_object = await UserUploads.get_upload(sub_file_id);
                    if(sub_file_object == null || !fs.existsSync(sub_file_object.file_path)){
                        res.send({success: false, reason: "One or more subtitle files do not exist!"});
                        return;
                    }
                    else{//next check if the language name and code have file safe names
                        let sub_language_name = subtitle.language_name;
                        let sub_language_code = subtitle.language_code;
                        if(sub_language_name == null || sub_language_name.trim().length == 0 || sub_language_name.length == 0){
                            res.send({success: false, reason: `The file ${sub_file_object.original_file_name} cannot have an empty language name.`});
                            return;
                        }
                        if(sub_language_code == null || sub_language_code.trim().length == 0 || sub_language_code.length == 0){
                            res.send({success: false, reason: `The file ${sub_file_object.original_file_name} cannot have an empty language name.`});
                            return;
                        }
    
                        if(!helper.valid_file_name(sub_language_name) || !helper.valid_file_name(sub_language_code)){
                            res.send({success: false, reason: `The file ${sub_file_object.original_file_name} does not have a valid language name or code.`});
                            return;
                        }
                    }
                }
            }
        }

        let show_id = selected_show.id;
    
        //Checks if the movie already exists
        let has_show = await Shows.has_show(show_id);
        if(has_show){
            res.send({success: false, reason: "This show already exists in Movie Buddy"});
            return;
        }

        let poster_image_url = selected_show.frontpage;
        let backdrop_image_url = selected_show.backdrop;
        let logo_image_url = selected_show.logo;
    
        //Gets the names of all of the images of the show itself
        let poster_file_name = "";
        if(poster_image_url != null){
            poster_file_name = path.basename(poster_image_url);
        }
        let backdrop_file_name = "";
        if(backdrop_image_url != null){
            backdrop_file_name = path.basename(backdrop_image_url);
        }
        let logo_file_name = "";
        if(logo_image_url != null){
            logo_file_name = path.basename(logo_image_url);
        }

        //Configure all of the folder paths
        let root = config.movieBuddyFolder;
        let shows_folder = path.join(root, "shows");
        let images_folder = path.join(root, "images");
        let the_show_folder = path.join(shows_folder, String(show_id));
        // let show_subtitle_folder = path.join(the_show_folder, "subtitles");  --Move to episode loop

        //Downloads all poster, backdrop, and logo image and saves them to the image folder
        FileManager.download_image(poster_image_url, path.join(images_folder, poster_file_name), (err) => {poster_file_name = ""});
        FileManager.download_image(backdrop_image_url, path.join(images_folder, backdrop_file_name), (err) => {backdrop_file_name = ""});
        FileManager.download_image(logo_image_url, path.join(images_folder, logo_file_name), (err) => {logo_file_name = ""});

        //After downloading the images replace the urls with their respective file names
        selected_show.frontpage = `${poster_file_name}`;
        selected_show.backdrop = `${backdrop_file_name}`;
        selected_show.logo = `${logo_file_name}`;

        FileManager.ensure_directory_existence(the_show_folder);
        // FileManager.ensure_directory_existence(the_show_folder);  --Move to episode loop

        //if the selected show does not have a key called seasons than create it
        if(!selected_show.hasOwnProperty("seasons")){
            selected_show["seasons"] = {};
        }

        //Iterate through all of the episodes and generate json, download images, and move subtitles
        for(let episode of episodes_list){
            let file_id = episode.file_id;
            let season_num = episode.season;
            let episode_num = episode.episode;
            let backdrop_url = episode.backdrop;
            let episode_subtitles = episode.subtitles != null ? episode.subtitles : [];

            let season_string = String(season_num);
            let episode_string = String(episode_num);

            //Configure the season and episode directory
            let season_directory = path.join(the_show_folder, String(season_num));
            let episode_directory = path.join(season_directory, String(episode_num));
            let episode_subtitles_directory = path.join(episode_directory, "subtitles");
            
            let episode_backdrop_filename = "";
            if(backdrop_url != null){
                episode_backdrop_filename = path.basename(backdrop_url);
            }

            //Download the episode image to the images folder
            FileManager.download_image(backdrop_url, path.join(images_folder, episode_backdrop_filename), (err) => {episode_backdrop_filename = ""});

            //Replace the backdrop url with just the image filename
            episode.backdrop = `${episode_backdrop_filename}`;

            //Ensure that the season and episode directory exists
            FileManager.ensure_directory_existence(episode_directory);
            
            //Ensure that the subtitles directory exists
            FileManager.ensure_directory_existence(episode_subtitles_directory);

            //Checks if the season exists, if not create an empty object with the season number being the key
            if(!selected_show["seasons"].hasOwnProperty(season_string)){
                selected_show["seasons"][season_string] = {};
            }

            //add the episode details to the seasons object
            delete episode.file_id;//delete the file id (no longer needed)
            selected_show["seasons"][season_string][episode_string] = episode;

            //Get the episode upload and get the episode file_location + its file extension
            let episode_upload = await UserUploads.get_upload(file_id);
            let episode_file_location = episode_upload.file_path;
            let episode_file_extension = path.extname(episode_file_location);

            //Move selected file to episode to its episode directory directory
            FileManager.move_file(episode_file_location, path.join(episode_directory, `${show_id}_${season_num}_${episode_num}${episode_file_extension}`));
            await UserUploads.delete_user_upload(episode_upload._id);
            for(let subtitle of episode_subtitles){
                let sub_file_id = subtitle.subtitle_file_id;
                let sub_language_name = subtitle.language_name;
                let sub_language_code = subtitle.language_code;
    
                let sub_file_object = await UserUploads.get_upload(sub_file_id);
                let sub_file_path = sub_file_object.file_path;
                let sub_file_extension = path.extname(sub_file_path);
    
                if(sub_file_object != null || fs.existsSync(sub_file_path)){
                    //Move the subtitles to the episode subtitles folder
                    FileManager.move_file(sub_file_object.file_path, path.join(episode_subtitles_directory, `${show_id}_${season_num}_${episode_num}_${sub_language_name}_${sub_language_code}${sub_file_extension}`));
    
                    //After selected file has been moved, delete it from the user_uploads database
                    await UserUploads.delete_user_upload(sub_file_object._id);
                }
            }
            delete episode.subtitles;
            
            //Write the episode details to a json and download it to the episode directory
            FileManager.write_json_to_file(JSON.stringify(episode, null, 4), path.join(episode_directory, `${show_id}_${season_num}_${episode_num}_details.json`));
        }

        //This must be done after iterating through the episodes
        //write the show details to a json in the show directory
        FileManager.write_json_to_file(JSON.stringify(selected_show, null, 4), path.join(the_show_folder, `${show_id}_details.json`));

        let add_show_result = await Shows.add_show(selected_show);

        res.send(add_show_result);
    }
});

module.exports = router;