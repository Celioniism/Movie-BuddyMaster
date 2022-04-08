const Mongoose = require("mongoose");
const config = require("@config");

let genres = new Mongoose.Schema({
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    }
}, {
    collections: config.collections.genres
});

module.exports = Mongoose.model("genres", genres);