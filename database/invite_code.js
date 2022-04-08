const Mongoose = require("mongoose");
const config = require("@config");
const random_string = require("randomstring");

let invite_codes = new Mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    used: {
        type: Boolean,
        required: true,
        default: false
    },
    generated_on: {
        type: Date,
        required: true
    },
    generated_by: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    used_by: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users"
    }
}, {
    collections: config.collections.invites
});

invite_codes.statics.get_invite_codes = async function(){
    try{
        let codes = await this.find({}).populate('used_by').exec();
        return codes;
    } catch(err){
        console.log(err);
    }
    return null;
}

invite_codes.statics.remove_invite_code = async function(id){
    try{
        await this.deleteOne({_id: id});
        return {success: true};
    } catch(err){
        console.log(err);
        return {success: false, reason: `error code ${err.code}`};
    }
}

/**
 * Removes an invite code based on the user id
 * Note: this does not remove the user object, this is used with the remove_user function in users.js
 * @param {ObjectId} user_id the user id
 * @returns an object containing whether or not the removal of the invite code was successful
 */
invite_codes.statics.remove_invite_code_by_user = async function(user_id){
    try{
        await this.deleteOne({used_by: user_id});
        return {success: true};
    } catch(err){
        console.log(err);
        return {success: false, reason: `error code ${err.code}`};
    }
}

/**
 * Generates an invite code
 * @param {ObjectId} user_id  the user id that will generate the code
 */
invite_codes.statics.generate_code = async function(user_id){
    let invite_code_string = "";
    let parts = 4;//how many sections there are in a invite code
    for(let i=0; i < parts; i++){
        let code_part = random_string.generate({
            length: 4,
            charset: "alphanumeric",
            capitalization: "uppercase"
        });
        invite_code_string += code_part;
        if(i < parts-1){
            invite_code_string += "-";
        }
    }

    let invite_code_fields = {
        code: invite_code_string,
        used: false,
        generated_on: new Date(),
        generated_by: user_id
    }

    let invite_code = new this(invite_code_fields);

    try{
        await invite_code.save();
        return invite_code;
    } catch(err){
        console.log(err);
        return {success: false, reason: "An error has occurred, unable to generate invite code"};
    }
}

/**
 * Checks to see if an invite exists in the system
 * @param {String} code An invite code
 * @returns true if the code exists, else return falses
 */
invite_codes.statics.check_if_exists = async function(code){
    let code_array = await this.find({code: code}).exec();
    if(code_array != 0){
        return true;
    }
    return false;
}

/**
 * Checks if a invite code has been used or not
 * @param {String} code An invite code that has been generated
 * @returns true if the code given has been used or if the code doesnt exist else returns false
 */
invite_codes.statics.is_used = async function(code){
    let code_array = await this.find({code: code}).exec();

    //this means this code was never generated and it does not exist
    if(code_array == 0){
        return true;//return true meaning it has been used
    }
    else{
        return code_array[0].used;
    }
}

//sets an invite code to used, returns if the operation has been successful
/**
 * 
 * Attempts to set an invite code to used
 * If the operation was successful, then will return true
 * @param {String} code The code the user has entered
 * @param {ObjectId} user_id The id of the user who used the code
 * @returns  If used has been set to successful returns an Object with key "success" set to true, 
 *          else key "success" will be set to false and there will be a reason provided
 */
invite_codes.statics.use = async function(code, user_id){
    let code_array = await this.find({code: code}).exec();
    
    //if the code_array is equal to 0, that means that code was never generated and doesn't exist
    if(code_array == 0){
        return {success: false, reason: "The code entered does not exist"};
    }

    //checks to see if the code has been used
    if(code_array[0].used){
        return {success: false, reason: "The code entered has already been used"};
    }

    code_array[0].used_by = user_id;
    code_array[0].used = true;
    code_array[0].save();
    return {success: true};
}

module.exports = Mongoose.model("invite_codes", invite_codes);