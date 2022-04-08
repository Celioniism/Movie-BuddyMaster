const Mongoose = require("mongoose");
const config = require("@config");

let sessions = new Mongoose.Schema({
    _id: {
        type: String
    },
    expires: {
        type: Date
    },
    session: {
        type: Object
    }
}, {
    collections: config.collections.sessions
});

sessions.statics.get_all = async function(){
    return await this.find({}).exec();
}

module.exports = Mongoose.model("sessions", sessions);