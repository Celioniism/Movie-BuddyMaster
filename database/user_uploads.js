const Mongoose = require("mongoose");
const config = require("@config");

let user_uploads = new Mongoose.Schema({
    user_id: {//The user who uploaded the file
        type: Mongoose.Schema.Types.ObjectId,
        required: true
    },
    date_uploaded: {//The date the user has uploaded this file
        type: Date,
        required: true
    },
    expiration_date: {//The date this file will be delete
        type: Date
    },
    file_size: {//The file size of the upload
        type: Number,
        required: true
    },
    file_path: {//The path of the file
        type: String,
        required: true
    },
    original_file_name: {//The original name of the file
        type: String,
        required: true
    },
    system_file_name: {//The file name that will be store on the file server
        type: String,
        required: true
    },
    name: {//A file name given to the file, this is the only field the user is able to modify
        type: String,
        required: true
    }
}, {
    collections: config.collections.user_uploads
});


/**
 * Gets an upload based on the upload_id
 * @param {String | ObjectId} upload_id The upload id
 * @returns the upload id if the id exists
 */
user_uploads.statics.get_upload = async function (upload_id) { 
    try{
        return await this.findById({_id: upload_id}).exec();
    } catch(err){
        console.log(err.message);
        return null;
    }
}

/**
 * Checks if an upload_id belongs to a certain user_id
 * @param {String | ObjectId} upload_id the upload id
 * @param {String | ObjectId} user_id the user id
 * @returns true if the upload belongs to a specific users, other wise returns false
 */
user_uploads.statics.belongs_to = async function (upload_id, user_id) {
    let result = null;
    try{
        result = await this.findOne({_id: upload_id, user_id: user_id}).exec();
    } catch(err){
        console.log(err.message);
    }
    return result != null;
}

/**
 * Retrieves all of the uploads that belong to a user, you may provide an array of extensions
 * @param {ObjectId} user_id The user id
 * @param {Array} extensions An array of extensions
 * @returns an array of user uploads
 */
user_uploads.statics.get_user_uploads = async function(user_id, extensions){
    let extensions_regex = null;
    if(extensions != null && extensions.constructor.name == "Array" && extensions.length > 0){
        extensions_regex = new RegExp(`\.(${extensions.join("|")})$`);
    }

    if(extensions_regex != null){
        return await this.find({user_id: user_id, original_file_name: {$regex: extensions_regex}}).exec();
    }
    else{
        return await this.find({user_id: user_id}).exec();
    }
}

user_uploads.statics.add_user_upload = async function (user_id, date_uploaded, expiration_date, file_size, file_path, original_file_name, system_file_name, name){
    let user_uploaded = new this({
        user_id: user_id,
        date_uploaded: date_uploaded, 
        expiration_date: expiration_date, 
        file_size: file_size, 
        file_path: file_path, 
        original_file_name: original_file_name, 
        system_file_name: system_file_name, 
        name: name
    });

    try {
        await user_uploaded.save();
        return {success: true};
    } catch (err){
        return {success: false, reason: "A fatal error has occurred, add_user_upload()"};
    }
}

user_uploads.statics.delete_user_upload = async function (upload_id){
    let result = null;
    try{
        result = await this.deleteOne({_id: upload_id}).exec();
    } catch(err){
        console.log(err);
    }
    return result;
}

module.exports = Mongoose.model("user_uploads", user_uploads);