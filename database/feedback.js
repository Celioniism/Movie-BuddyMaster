const Mongoose = require("mongoose");
const config = require("@config");

let feedback = new Mongoose.Schema({
    user_id: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    date_submitted: {
        type: Date,
        required: true
    }
}, {
    collections: config.collections.feedback
});

feedback.statics.get_all_feedback = async function(){
    let feedbacks = await this.find({}).populate("user_id").exec();
    return feedbacks;
}

/**
 * Checks if a feedback object belongs to a user
 * @param {ObjectId} user_id the user id
 * @param {ObjectId} feedback_id The feedback id
 * @returns an object that contains whether or not the feedback belongs to the user
 */
feedback.statics.belongs_to = async function(user_id, feedback_id){
    let feedback = await this.find({_id: feedback_id, user_id: user_id}).exec();
    if(feedback.length != 0){
        return {success: true, feedback: feedback};
    }
    else{
        return {success: false, reason: "This feedback does not belong to this user"};
    }
}

/**
 * Adds a users feedback to the database
 * @param {ObjectId} user_id the user_id
 * @param {String} subject The subject of the feedback
 * @param {String} description The description
 * @returns an object that contains if the feedback has successfully been added, else returns an object with a reason
 */
feedback.statics.add_feedback = async function(user_id, subject, description){
    let feedback = new this({
        user_id: user_id,
        subject: subject,
        description: description,
        date_submitted: new Date()
    });

    try {
        await feedback.save();
        return {success: true, feedback: feedback};
    } catch (err){
        return {success: false, reason: "A fatal error has occurred, add_feedback()"};
    }
}

/**
 * Removes a users feedback from the database
 * @param {ObjectId} feedback_id the feedback_id
 */
feedback.statics.remove_feedback = async function(user_id, feedback_id){
    try{
        let result = await this.deleteOne({_id:  feedback_id, user_id: user_id});
        if(result && result.deletedCount >= 1){
            return {success: true};
        }
    } catch(err){
        return {success: false, reason: "A fatal error has occurred, remove_feedback()"};
    }
}

/**
 * Retrieves all of the feedback that a single user has sent
 * @param {ObjectId} user_id the users id
 * @returns all of the users feedback in an array
 */
feedback.statics.get_all_feedback_by_user = async function(user_id){
    let result = await this.find({user_id: user_id}).exec();
    return result;
}

module.exports = Mongoose.model("feedback", feedback);