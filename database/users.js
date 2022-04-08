const Mongoose = require("mongoose");
const config = require("@config");
const crypto = require("crypto");
const validator = require("validator");

const Invite = require("@collections/invite_code.js");
const UserStatistics = require("@collections/user_statistics.js");

const Movies = require("@collections/movies");
const Shows = require("@collections/shows");

let user = new Mongoose.Schema({
    username: {
        type: String,
        required: true,
        set: username_to_lowercase
    },
    username_lowercase: {
        type: String,
    },
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        set: email_to_lowercase
    },
    password_hash: {
        type: String,
        required: true
    },
    password_salt: {
        type: String,
        required: true
    },
    type: { //admin, regular, etc.
        type: String,
        required: true
    },
    profile_picture: {
        type: String
    },
    profile_background: {
        type: String
    },
    user_statistics: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "user_statistics"
    }

}, {
    collections: config.collections.users
});

function username_to_lowercase(value){
    this.username_lowercase = value.toLowerCase();
    return value;
}

function email_to_lowercase(value){
    if(value != null){
        value = value.toLowerCase();
    }
    return value;
}

user.methods.get_statistics = async function(){
    let stats = null;
    if(this.user_statistics == null){
        //if user statistics does not exist, check the user_statistics collection to see if it exists there
        stats = await UserStatistics.get_statistics_by_user(this._id);
        //if found, then save the user_statistics to the user
        if(stats != null){
            this.user_statistics = stats._id;
            await this.save();
        }
        //else create a new user_statistics
        else{
            stats = await UserStatistics.create_statistics(this._id);
            if(stats != null){//this should always be called
                this.user_statistics = stats._id;
                await this.save();
            }
        }
    }
    else{
        stats = await UserStatistics.get_statistics(this.user_statistics);
    }
    return stats;
}

user.statics.get_all_users = async function(){
    return await this.find({}).populate("user_statistics").exec();
}

/**
 * Checks if a username has already been used by another user
 * @param {String} username A username
 * @returns  true if the username has already been used, else false
 */
user.statics.does_username_exist = async function (username){
    let username_array = await this.find({username_lowercase: username.toLowerCase()}).exec();
    return username_array.length != 0;
}

/**
 * Checks if an email has already been used by another user
 * @param {String} email An email
 * @returns  true if the email has already been used, else false
 */
user.statics.does_email_exist = async function (email){
    let email_array = await this.find({email: email}).exec();
    return email_array.length != 0;
}

/**
 * Validates the user by checking if the email exists and checks if the password matches an existing user
 * @param {String} email An email
 * @param {String} password A password
 * @returns  An object containing if the validation was successful, if so then it will also return the user object, else returns a reason
 */
user.statics.validate_user = async function (email, password){
    let account = await this.findOne({email: email}).exec();

    if(account != null){
        let valid = account.verify_password(password);
        if(valid){
            delete account.password_hash;
            delete account.password_salt;

            return {success: true, user: account};
        }
        else{
            return {success: false, reason: "Incorrect password", key: "password"};
        }
    }
    return {success: false, reason: "User with this email does not exist", key: "email"};
}

/**
 * Gets the details of a specific user based on their username
 * @param {String} username the users username
 * @returns THe users details if the username exists, else null
 */
user.statics.get_user_by_username = async function(username){
    let user = await this.findOne({username_lowercase: username.toLowerCase() }).exec();
    return user;
}

/**
 * Gets the details of a specific user
 * @param {ObjectId} id A users _id
 * @returns The users details if the _id exists, else empty object or null
 */
 user.statics.get_details = async function(id){
    try{
        let user = await this.findById(id).exec();
        return user;
    } catch(err){
        console.log(err.message);
        return null;
    }
}

user.statics.create_user = async function (email, username, first_name, last_name, password, invite_code){
    if(await this.does_email_exist(email)){
        return {success: false, reason: "A user with that email already exists"};
    }
    if(await this.does_username_exist(username)){
        return {success: false, reason: `${username} has already been taken`};
    }

    let salt_and_hash = create_salt_and_hash(password);

    let user_fields = {
        username: username,
        username_lowercase: username.toLowerCase(),
        first_name: first_name,
        last_name: last_name,
        email: email,
        password_hash: salt_and_hash.hash,
        password_salt: salt_and_hash.salt,
        type: "regular"
    }
    let user = new this(user_fields);

    try{
        let is_used = await Invite.is_used(invite_code);
        if(!is_used){//the code has not been used
            let used_result = await Invite.use(invite_code, user._id);
            if(used_result["success"] == true){//the code has successfully been used
                //if this fails, the invite code will be used with the user not having an account
                //will fix later
                await user.save();
                return {success: true, user: user};
            }
            else{
                return used_result;
            }
        }
        else{//the code has been used/doesnt exist
            return {success: false, reason: "The invite code you entered either does not exist or it has already been used"};
        }
    } catch(err){
        console.log(err);
        return {success: false, reason: "An error has occurred, unable to create account"};
    }
}

user.statics.delete_user = async function(user_id){
    let user = await this.get_details(user_id);
    if(user != null){
        await UserStatistics.remove_statistics_by_user(user_id);
        await Invite.remove_invite_code_by_user(user_id);
        try{
            await this.deleteOne({_id: user_id});
            return {success: true};
        } catch(err){
            return {success: false, reason: `error code ${err.code}`};
        }
    }
    return {success: false, reason: "User not found"}
}

user.methods.change_profile_picture = async function(profile_image_path){
    this.profile_picture = profile_image_path;
    try{
        this.save();
        return true;
    } catch(err){
        return false;
    }
}

/**
 * Changes a users basic information, username, firstname, lastname, email
 * @param {String} new_details_object this can contain keys [email, username, first_name, last_name] and the values must be strings
 * @returns results object
 */
user.methods.change_details = async function(new_details_object){
    let changed = false;

    let results = {};

    if(new_details_object.hasOwnProperty("email") && this.email != new_details_object.email){
        let email = new_details_object.email;
        if(await this.constructor.does_email_exist(email)){
            results["email"] = {success: false, reason: "A user with that email already exists"};
        }
        else if(email.length == 0){
            results["email"] = {success: false, reason: "Email cannot be empty"};
        }
        else if (!validator.isEmail(email)) {
            results["email"] = {success: false, reason: "The email you entered is invalid"};
        }
        else{
            this.email = email.trim();
            results["email"] = {success: true, reason: "Email has been changed", email: this.email};
            changed = true;
        }
    }
    if(new_details_object.hasOwnProperty("username") && this.username != new_details_object.username){
        let username = new_details_object.username;
        if(await this.constructor.does_username_exist(username)){
            results["username"] = {success: false, reason: "A user with that username already exists"};
        }
        else if(username.length == 0){
            results["username"] = {success: false, reason: "Username cannot be empty"};
        }
        else{
            this.username = username.trim();
            results["username"] = {success: true, reason: "Username has been changed", username: this.username};
            changed = true;
        }
    }
    if(new_details_object.hasOwnProperty("first_name") && this.first_name != new_details_object.first_name){
        let first_name = new_details_object.first_name;
        if(first_name.length == 0){
            results["first_name"] = {success: false, reason: "First name cannot be empty"};
        }
        else{
            this.first_name = first_name.trim();
            results["first_name"] = {success: true, reason: "First name has been changed", fullname: `${this.first_name} ${this.last_name}`};
            changed = true;
        }
    }
    if(new_details_object.hasOwnProperty("last_name") && this.last_name != new_details_object.last_name){
        let last_name = new_details_object.last_name;
        if(last_name.length == 0){
            results["last_name"] = {success: false, reason: "Last name cannot be empty"};
        }
        else{
            this.last_name = last_name.trim();
            results["last_name"] = {success: true, reason: "Last name has been changed", fullname: `${this.first_name} ${this.last_name}`};
            changed = true;
        }
    }

    if(changed){
        try{
            await this.save();
        } catch (err){
            results["error"] = {success: false, reason: err.reason};
            console.log(err);
            console.log(err._message);
        }
    }

    return results;
}

user.methods.verify_password = async function(current_password){
    let hash = this.password_hash;
    let salt = this.password_salt;

    let checkHash = verify_hash(current_password, salt);
    if(hash == checkHash){
        return true;
    }
    else{
        return false;
    }
}

user.methods.change_password = async function (current_password, new_password){
    let valid = this.verify_password(current_password);
    if(valid){//they user has entered the correct password
        let salt_and_hash = create_salt_and_hash(new_password);
        this.password_hash = salt_and_hash.hash;
        this.password_salt = salt_and_hash.salt;
        try{
            await this.save();
            return {success: true, reason: "Password has been successfully changed!"};
        } catch(err){
            return {success: false, reason: err.message};
        }
    }
    else{
        return {success: false, reason: "You have entered the incorrect password!"};
    }
}

function create_salt_and_hash(password) {

    // Creating a unique salt for a particular user 
    let salt = crypto.randomBytes(16).toString('hex');

    // Hashing user's salt and password with 1000 iterations, 
    //64 length and sha512 digest 
    let hash = crypto.pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);

    return {
        salt: salt, 
        hash: hash
    };
}

function verify_hash(password, salt) { 
    var hash = crypto.pbkdf2Sync(password,  
    salt, 1000, 64, `sha512`).toString(`hex`); 
    return hash;
}

module.exports = Mongoose.model("users", user);