let config = require("@config");
let mongoose = require("mongoose");

let request = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "users",
        required: true
    },
    media_name: {
        type: String,
        required: true
    },
    imdb_link: {
        type: String,
        required: true
    },
    date_requested: {//the date that a movie was requested
        type: Date,
        required: true
    },
    status: { // Completed (#00cc4e), Pending (#ffe700), Cancelled (#c80000), Spam (#ff6600)
        type: String,
        required: true,
        default: "Pending"
    },
    imdb_id: {//this will be parsed from the imdbLink if possible
        type: String
    },
    reason: {// reason why a request was cancelled
        type: String
    },
    date_completed: {// when the request has been downloaded and uploaded to the river
        type: Date
    }
}, {
    collection: config.collections.requests
});

request.statics.get_all_requests = async function(){
    return await this.find({}).populate('user').exec();
}

request.statics.get_all_requests_by_user = async function(user_id){//gets the total number of requests the user has sent
    let result = await this.find({user: user_id}).exec();
    return result;
}

request.statics.get_total_requests_by_user = async function(user_id){//gets the total number of requests the user has sent
    let result = await this.find({user: user_id}).exec();
    return result.length;
}

request.statics.belongs_to = async function(user_id, request_id){
    let feedback = await this.find({_id: request_id, user: user_id}).exec();
    if(feedback.length != 0){
        return {success: true, feedback: feedback};
    }
    else{
        return {success: false, reason: "This request does not belong to this user"};
    }
}

request.statics.can_request = async function(user_id){//check to see if the user is able to continue to request
    let result = await this.get_total_requests_by_user(user_id);
    return result < 5;//this should not just be 5, they should depend on which role the user is. ex: an admin can request as many as he likes by a normal member can only request 5 and a premium user can request like 20
}

request.statics.add_request = async function(user_id, media_name, imdb_link) {
    let imdb_path_name = imdb_link;
    try{
        let imdb_link_parts = new URL(imdb_link);
        imdb_path_name = imdb_link_parts.pathname;

        let title_location = imdb_path_name ? imdb_path_name.indexOf("title/") : -1;
        if(title_location != -1){
            imdb_path_name = imdb_path_name.substring(title_location + "title/".length);
            let next_slash = imdb_path_name.indexOf("/");
            next_slash = next_slash != -1 ? next_slash : imdb_path_name.length;
            imdb_path_name = imdb_path_name.substring(0, next_slash);
        }
        else{
            imdb_path_name = imdb_link;
        }
    } catch(err){
        imdb_path_name = imdb_link;
    }

    let new_request = new this({
        user: user_id,
        media_name: media_name,
        imdb_link: imdb_link,
        imdb_id: imdb_path_name,
        date_requested: new Date()
    });

    try{
        await new_request.save();
        return {success: true, request: new_request};
    } catch(err){
        return {success: false, reason: err.message};
    }
}

request.statics.get_request = async function(request_id){
    try{
        let request = await this.findById(request_id).exec();
        return request;
    } catch(err){
        console.log(err.message);
        return null;
    }
}

request.statics.remove_request = async function(request_id){
    try{
        let result = await this.deleteOne({_id:  request_id});
        if(result && result.deletedCount >= 1){
            return {success: true};
        }
    } catch(err){
        return {success: false, reason: "We are unable to delete your request at this time."};
    }
}

request.methods.change_status = async function(status){
    if(status == "Completed" || status == "Pending" || status == "Cancelled" || status == "Spam"){
        // if(!this.status){//this means that this document does not have a status yet
        //     this.status = status;
        //     // return {status: 0}
        // }

        if(this.status != status){
            this.status = status;
            if(status == "Completed" || status == "Cancelled" || status == "Spam" ){
                this.date_completed = new Date();
            }
            if(status == "Pending"){
                this.date_completed = undefined;
            }
            try{
                await this.save();
                return {success: true, status: status, date_completed: this.date_completed};
            } catch(err){
                console.log(err);
                return {success: false, reason: err.message};
            }
        }
    }
    else{
        return {status: false, reason: "Invalid status"}
    }
}

module.exports = mongoose.model("requests", request);