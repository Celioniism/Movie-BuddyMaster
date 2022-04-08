const fs = require("fs");
// const request = require('request');
const http = require('http');
const https = require('https');
const path = require("path");
const config = require("@config");


/**
 * Reads a json from a file
 * @param {String} file_path The path of the file
 * @returns a json object
 */
function read_from_file(file_path) {
    try {
        return JSON.parse(fs.readFileSync(file_path, { encoding: "utf-8" }));
    } catch (err) {
        console.log(err);
    }
}

/**
 * Writes a JSON object to a file
 * 
 * @param {String} json A json string that will be written to the file
 * @param {String} write_path The path to write the object to (Note: write path must also contain the file name with extension)
 * Example: "C:\\Users\\John\\Desktop\\myFile.json"
 */
function write_json_to_file(json, write_path) {
    try {
        fs.writeFileSync(write_path, json, { encoding: "utf-8", flag: 'w' });
    } catch (err) {
        console.log("ERROR");
        console.log(err);
    }
}

/**
 * Ensures that the directory path exists, if it does not exist the direectory path will be created
 * @param {String} file_path The file/folder path to check
 * @param {Boolean} is_file if the file/folder path is a file or not
 * @returns true if the folder has successfully been created
 */
function ensure_directory_existence(file_path, is_file = false) {
    var dirname = is_file ? path.dirname(path.resolve(file_path)) : path.resolve(file_path);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensure_directory_existence(dirname, true);
    fs.mkdirSync(dirname);
}

/**
 * @callback arrayCallback
 * @param  {String} [error_message] - An error message if an error occurs
 */

/**
 * Downloads an image from a url to a file location on the file system
 * @param {String} url The image url
 * @param {String} dest_file_path The file path of where the image will be downloaded to
 * @param {Function} callback the callback function when the image has finished downloading
 */
function download_image (url, dest_file_path, callback) {
    if(fs.existsSync(dest_file_path)){
        callback("A file already exists under this name");
        return;
    }
    var file = fs.createWriteStream(dest_file_path, {flags: "w"});
    file.on('error', function(err) {
        if (callback) {
            callback(err);
        }
        file.end();
    });
    try{
        var request = https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(callback);  // close() is async, call callback after close completes.
            });
        })
        
        request.on('error', function (err) { // Handle errors
            fs.unlink(dest_file_path, (err) => { // Delete the file async. (But we don't check the result)
                if (err) callback(err.message);
            });
            
            if (callback) {
                callback(err.message);
            }
        });
    } catch(err){
        if(fs.existsSync(dest_file_path)){
            if(!fs.lstatSync(dest_file_path).isDirectory()){
                fs.unlink(dest_file_path, (err) => { // Delete the file async. (But we don't check the result)
                    if (err) callback(err.message);
                });
            }
        }
        if(callback){
            callback(err.message);
        }
    }
};

/**
 * Moves a file from one location to another
 * @param {String} current_file_location The current file location (must contain file name)
 * @param {String} new_file_location The new file location (Must contain file name)
 */
function move_file(current_file_location, new_file_location){
    if (fs.existsSync(current_file_location)) {
        fs.renameSync(current_file_location, new_file_location);
    }
    else{
        return false;
    }
}

/**
 * Deletes a file one the file system
 */
function delete_file(path){
    if(path != null && fs.existsSync(path)){
        fs.unlinkSync(path);
        return true;
    }
    else{
        return false;
    }
}


/******************************
 * 
 * CUSTOM FUNCTIONS FOR MOVIE BUDDY START
 * 
 ******************************/

/**
- files
    - movies
        - #movie_id
            - #movie_id_movie_details.json
            - #movie_id.mp4
            - subtitles
                #movie_id_#language.ssa
                #movie_id_#language.vtt
    - shows
    - uploads
    - images

 * This function creates all of the folders that will be located in the "movie buddy folder"
 */

function create_file_system (){
    let root = config.movieBuddyFolder;
    ensure_directory_existence(path.join(root, "movies"));
    ensure_directory_existence(path.join(root, "shows"));
    ensure_directory_existence(path.join(root, "uploads"));
    ensure_directory_existence(path.join(root, "images"));
    ensure_directory_existence(path.join(root, "profile_images"));
}


/*****************************
 * 
 * CUSTOM FUNCTIONS FOR MOVIE BUDDY END
 * 
 *****************************/
exports.read_from_file = read_from_file;
exports.write_json_to_file = write_json_to_file;
exports.ensure_directory_existence = ensure_directory_existence;
exports.download_image = download_image;
exports.move_file = move_file;
exports.delete_file = delete_file;
exports.create_file_system = create_file_system;